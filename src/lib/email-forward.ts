import nodemailer, { type Transporter } from "nodemailer";
import { createHash } from "crypto";
import { lookup } from "dns/promises";
import { stat } from "fs/promises";
import net from "net";
import path from "path";
import type { EmailForward, Message, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { logger } from "./logger";
import { decryptString, encryptString, isEncryptedBlob } from "./data-encryption";
import { isPrivateAddress, webhooksAllowPrivate } from "./safe-fetch";

/**
 * Real-time forwarding of private WhatsApp conversations to e-mail.
 *
 * Every new message of a private chat (incoming, and optionally outgoing) becomes one e-mail with the
 * contact's data, the latest messages of the chat and the media as an attachment. Sends are serialized
 * per session and capped per hour so a busy number cannot exhaust the SMTP provider's daily quota.
 */

export const SMTP_PASSWORD_MASK = "••••••••";
export const MAX_RECIPIENTS = 5;
export const MAX_CONTEXT_MESSAGES = 20;
const MAX_EMAILS_PER_HOUR = 300;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const CONFIG_CACHE_MS = 30_000;
const RETRY_DELAY_MS = 15_000;

export type SmtpErrorCode = "auth" | "connection" | "tls" | "recipient" | "private_host" | "unknown";

export interface SmtpSettings {
    host: string;
    port: number;
    secure: boolean;
    user?: string | null;
    pass?: string | null;
    from?: string | null;
}

export class EmailForwardError extends Error {
    constructor(public code: SmtpErrorCode, message: string) {
        super(message);
    }
}

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;

export function isValidEmail(value: string): boolean {
    return value.length <= 254 && EMAIL_RE.test(value);
}

/** Split "a@x.com, b@y.com; c@z.com" into unique, trimmed addresses (invalid entries are kept for validation). */
export function parseRecipients(raw: string | null | undefined): string[] {
    if (!raw) return [];
    const seen = new Set<string>();
    for (const part of raw.split(/[\s,;]+/)) {
        const email = part.trim();
        if (email) seen.add(email.toLowerCase());
    }
    return [...seen];
}

const passwordAad = (dbSessionId: string) => `email-forward:${dbSessionId}`;

export function encryptSmtpPassword(dbSessionId: string, password: string): Prisma.InputJsonObject {
    // Spread into a plain object so Prisma accepts it as a Json value
    return { ...encryptString(password, passwordAad(dbSessionId)) };
}

export function decryptSmtpPassword(dbSessionId: string, stored: unknown): string | null {
    if (!isEncryptedBlob(stored)) return null;
    try {
        return decryptString(stored, passwordAad(dbSessionId));
    } catch (e) {
        logger.error("EmailForward", "Could not decrypt the SMTP password (DATA_ENCRYPTION_KEY changed?)", e);
        return null;
    }
}

export function settingsFromConfig(config: EmailForward): SmtpSettings {
    return {
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        user: config.smtpUser,
        pass: decryptSmtpPassword(config.sessionId, config.smtpPass),
        from: config.fromAddress,
    };
}

// ---------------------------------------------------------------------------
// SMTP transport
// ---------------------------------------------------------------------------

/**
 * Resolve the SMTP host once and connect to that IP (with SNI/certificate checks against the name),
 * so a DNS answer cannot switch to an internal address between the check and the connection.
 */
async function resolveSmtpHost(host: string): Promise<string> {
    const allowPrivate = webhooksAllowPrivate();
    let addresses: string[];
    if (net.isIP(host)) {
        addresses = [host];
    } else {
        try {
            addresses = (await lookup(host, { all: true })).map((entry) => entry.address);
        } catch {
            throw new EmailForwardError("connection", `Servidor SMTP não encontrado: ${host}`);
        }
    }
    if (!allowPrivate && addresses.some(isPrivateAddress)) {
        throw new EmailForwardError(
            "private_host",
            "O servidor SMTP aponta para um endereço interno. Para permitir, defina ALLOW_PRIVATE_WEBHOOK_URLS=\"true\".",
        );
    }
    // Prefer IPv4 like nodemailer's own resolver: many networks resolve AAAA records but cannot route IPv6
    return addresses.find((address) => net.isIPv4(address)) ?? addresses[0];
}

export async function createSmtpTransport(settings: SmtpSettings): Promise<Transporter> {
    const address = await resolveSmtpHost(settings.host);
    return nodemailer.createTransport({
        host: address,
        port: settings.port,
        secure: settings.secure,
        // Never send credentials or messages in clear text: plain SMTP must upgrade with STARTTLS
        requireTLS: !settings.secure,
        tls: net.isIP(settings.host) ? undefined : { servername: settings.host },
        auth: settings.user ? { user: settings.user, pass: settings.pass || "" } : undefined,
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 60_000,
    });
}

/** Map nodemailer errors to a stable code the dashboard can translate, plus the raw server reply. */
export function describeSmtpError(error: unknown): { code: SmtpErrorCode; message: string } {
    if (error instanceof EmailForwardError) return { code: error.code, message: error.message };
    const err = error as { code?: string; responseCode?: number; message?: string };
    const message = (err?.message || String(error)).slice(0, 500);
    switch (err?.code) {
        case "EAUTH":
            return { code: "auth", message };
        case "ETLS":
            return { code: "tls", message };
        case "EENVELOPE":
            return { code: "recipient", message };
        case "ECONNECTION":
        case "ETIMEDOUT":
        case "ESOCKET":
        case "EDNS":
            return { code: "connection", message };
    }
    if (err?.responseCode && err.responseCode >= 550 && err.responseCode < 560) return { code: "recipient", message };
    return { code: "unknown", message };
}

function fromHeader(settings: SmtpSettings, appName: string): string {
    const address = settings.from?.trim() || settings.user?.trim() || "";
    if (!address) throw new EmailForwardError("unknown", "Informe o remetente (campo De) ou o usuário do SMTP.");
    return address.includes("<") ? address : `"${appName.replace(/"/g, "")}" <${address}>`;
}

// ---------------------------------------------------------------------------
// Caches, queue and rate limit (per database session id)
// ---------------------------------------------------------------------------

const configCache = new Map<string, { config: EmailForward | null; at: number }>();
const transports = new Map<string, { key: string; transport: Transporter }>();
const queues = new Map<string, Promise<void>>();
const sentTimes = new Map<string, number[]>();

async function getConfig(dbSessionId: string): Promise<EmailForward | null> {
    const cached = configCache.get(dbSessionId);
    if (cached && Date.now() - cached.at < CONFIG_CACHE_MS) return cached.config;
    const config = await prisma.emailForward.findUnique({ where: { sessionId: dbSessionId } });
    configCache.set(dbSessionId, { config, at: Date.now() });
    return config;
}

/** Call after saving or deleting a config so the next message uses it right away. */
export function invalidateEmailForward(dbSessionId: string) {
    configCache.delete(dbSessionId);
    const current = transports.get(dbSessionId);
    if (current) {
        current.transport.close();
        transports.delete(dbSessionId);
    }
}

async function getTransport(config: EmailForward): Promise<Transporter> {
    const key = config.updatedAt.toISOString();
    const current = transports.get(config.sessionId);
    if (current?.key === key) return current.transport;
    current?.transport.close();
    const transport = await createSmtpTransport(settingsFromConfig(config));
    transports.set(config.sessionId, { key, transport });
    return transport;
}

function enqueue(dbSessionId: string, job: () => Promise<void>) {
    const previous = queues.get(dbSessionId) ?? Promise.resolve();
    const next = previous.then(job).catch((e) => logger.error("EmailForward", "Unexpected queue error", e));
    queues.set(dbSessionId, next);
    next.finally(() => {
        if (queues.get(dbSessionId) === next) queues.delete(dbSessionId);
    });
}

function withinHourlyLimit(dbSessionId: string): boolean {
    const now = Date.now();
    const recent = (sentTimes.get(dbSessionId) || []).filter((t) => now - t < 3_600_000);
    if (recent.length >= MAX_EMAILS_PER_HOUR) {
        sentTimes.set(dbSessionId, recent);
        return false;
    }
    recent.push(now);
    sentTimes.set(dbSessionId, recent);
    return true;
}

async function recordResult(dbSessionId: string, error: string | null) {
    try {
        await prisma.emailForward.update({
            where: { sessionId: dbSessionId },
            data: error
                ? { lastError: error, lastErrorAt: new Date() }
                : { sentCount: { increment: 1 }, lastSentAt: new Date(), lastError: null, lastErrorAt: null },
        });
    } catch {
        // Config deleted meanwhile: nothing to record
    }
}

// ---------------------------------------------------------------------------
// E-mail content
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
    TEXT: "",
    IMAGE: "📷 Imagem",
    VIDEO: "🎬 Vídeo",
    AUDIO: "🎤 Áudio",
    DOCUMENT: "📄 Documento",
    STICKER: "🖼️ Figurinha",
    LOCATION: "📍 Localização",
    CONTACT: "👤 Contato",
};

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** "5511988887777@s.whatsapp.net" -> "+55 11 98888-7777" (other countries: "+<digits>"). */
export function formatPhone(jid: string | null | undefined): string | null {
    if (!jid || !jid.endsWith("@s.whatsapp.net")) return null;
    const digits = jid.split("@")[0].split(":")[0];
    if (!/^\d{8,15}$/.test(digits)) return null;
    const br = digits.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
    if (br) return `+55 ${br[1]} ${br[2]}-${br[3]}`;
    return `+${digits}`;
}

function messageText(message: Pick<Message, "type" | "content">): string {
    const label = TYPE_LABELS[message.type] ?? `[${message.type}]`;
    const content = (message.content || "").trim();
    if (message.type === "LOCATION" && content) {
        return `${label}: https://maps.google.com/?q=${encodeURIComponent(content)}`;
    }
    if (!label) return content || "(mensagem vazia)";
    return content ? `${label}: ${content}` : label;
}

interface Row {
    label: string;
    value: string;
    href?: string;
}

interface EmailContent {
    subject: string;
    text: string;
    html: string;
    attachments: { filename: string; path: string }[];
    threadId: string;
}

async function buildEmail(config: EmailForward, message: Message): Promise<EmailContent> {
    const dbSessionId = config.sessionId;
    const jid = message.remoteJid;

    const [session, contact, labels, stats, system, previous] = await Promise.all([
        prisma.session.findUnique({ where: { id: dbSessionId }, select: { name: true, sessionId: true } }),
        prisma.contact.findUnique({ where: { sessionId_jid: { sessionId: dbSessionId, jid } } }),
        prisma.chatLabel.findMany({
            where: { chatJid: jid, label: { sessionId: dbSessionId } },
            select: { label: { select: { name: true } } },
        }),
        prisma.message.aggregate({
            where: { sessionId: dbSessionId, remoteJid: jid },
            _count: { _all: true },
            _min: { timestamp: true },
        }),
        prisma.systemConfig.findUnique({ where: { id: "default" }, select: { appName: true, timezone: true } }),
        config.contextMessages > 0
            ? prisma.message.findMany({
                where: { sessionId: dbSessionId, remoteJid: jid, id: { not: message.id }, timestamp: { lte: message.timestamp } },
                orderBy: { timestamp: "desc" },
                take: Math.min(config.contextMessages, MAX_CONTEXT_MESSAGES),
            })
            : Promise.resolve([] as Message[]),
    ]);

    const appName = system?.appName || "W-AZAP";
    const timeZone = process.env.TZ || system?.timezone || "UTC";
    const formatDate = (date: Date) =>
        new Intl.DateTimeFormat("pt-BR", { timeZone, dateStyle: "short", timeStyle: "short" }).format(date);

    const phone = formatPhone(jid) || formatPhone(contact?.remoteJidAlt);
    const contactName = contact?.name || contact?.notify || contact?.verifiedName || message.pushName || phone || jid.split("@")[0];
    const sender = message.fromMe ? "Você" : contactName;
    const body = messageText(message);
    const preview = body.replace(/\s+/g, " ").slice(0, 70);

    // Contact card: every known field, then any extra scalar data WhatsApp sent for this contact
    const rows: Row[] = [
        { label: "Nome", value: contactName },
        ...(phone ? [{ label: "Telefone", value: phone, href: `https://wa.me/${phone.replace(/\D/g, "")}` }] : []),
        ...(contact?.notify && contact.notify !== contactName ? [{ label: "Nome no WhatsApp", value: contact.notify }] : []),
        ...(contact?.verifiedName ? [{ label: "Nome comercial", value: contact.verifiedName }] : []),
        { label: "JID", value: jid },
        ...(contact?.lid ? [{ label: "LID", value: contact.lid }] : []),
        ...(contact?.remoteJidAlt && contact.remoteJidAlt !== jid ? [{ label: "JID alternativo", value: contact.remoteJidAlt }] : []),
        ...(labels.length ? [{ label: "Etiquetas", value: labels.map((l) => l.label.name).join(", ") }] : []),
        ...(contact?.profilePic?.startsWith("http") ? [{ label: "Foto de perfil", value: "abrir", href: contact.profilePic }] : []),
        { label: "Mensagens na conversa", value: String(stats._count._all) },
        ...(stats._min.timestamp ? [{ label: "Primeira mensagem", value: formatDate(stats._min.timestamp) }] : []),
        ...(contact?.createdAt ? [{ label: "Contato salvo em", value: formatDate(contact.createdAt) }] : []),
        { label: "Sessão", value: session?.name ? `${session.name} (${session.sessionId})` : session?.sessionId || "" },
    ];
    const shown = new Set(["id", "lid", "name", "notify", "verifiedName", "imgUrl", "jid"]);
    if (contact?.data && typeof contact.data === "object" && !Array.isArray(contact.data)) {
        for (const [key, value] of Object.entries(contact.data as Record<string, unknown>)) {
            if (shown.has(key) || value === null || value === undefined || value === "") continue;
            if (["string", "number", "boolean"].includes(typeof value)) rows.push({ label: key, value: String(value) });
        }
    }

    const baseUrl = (process.env.BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    const chatUrl = baseUrl && phone ? `${baseUrl}/dashboard/chat/${phone.replace(/\D/g, "")}` : null;

    const history = [...previous].reverse();
    const line = (m: Message) => `${formatDate(m.timestamp)}  ${m.fromMe ? "Você" : contactName}: ${messageText(m)}`;

    // Attachment for the new message (files live in data/media; the stored URL is /api/media/<file>)
    const attachments: EmailContent["attachments"] = [];
    let attachmentNote = "";
    if (config.attachMedia && message.mediaUrl) {
        const filename = path.basename(message.mediaUrl.split("?")[0]);
        const filePath = path.join(process.cwd(), "data", "media", filename);
        try {
            const info = await stat(filePath);
            if (info.size <= MAX_ATTACHMENT_BYTES) attachments.push({ filename, path: filePath });
            else attachmentNote = `Arquivo não anexado: ${(info.size / 1024 / 1024).toFixed(1)} MB (limite de 10 MB).`;
        } catch {
            attachmentNote = "Arquivo de mídia não encontrado no servidor.";
        }
    }

    const subject = message.fromMe
        ? `[${appName}] Você → ${contactName}: ${preview}`
        : `[${appName}] ${contactName}: ${preview}`;

    const text = [
        `${sender} · ${formatDate(message.timestamp)}`,
        "",
        body,
        attachmentNote ? `\n(${attachmentNote})` : "",
        "",
        "— Contato —",
        ...rows.map((r) => `${r.label}: ${r.href && r.value === "abrir" ? r.href : r.value}`),
        ...(history.length ? ["", `— Últimas ${history.length} mensagens —`, ...history.map(line)] : []),
        ...(chatUrl ? ["", `Abrir no ${appName}: ${chatUrl}`] : []),
    ].join("\n");

    const cell = "padding:6px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top;";
    const rowHtml = (r: Row) =>
        `<tr><td style="${cell}color:#6b7280;white-space:nowrap">${escapeHtml(r.label)}</td><td style="${cell}">${
            r.href ? `<a href="${escapeHtml(r.href)}" style="color:#15803d">${escapeHtml(r.value)}</a>` : escapeHtml(r.value)
        }</td></tr>`;
    const bubble = (m: Message, highlight: boolean) => `
        <div style="margin:6px 0;${m.fromMe ? "text-align:right" : ""}">
          <div style="display:inline-block;max-width:85%;text-align:left;padding:8px 12px;border-radius:10px;background:${
              highlight ? "#dcfce7" : m.fromMe ? "#f0fdf4" : "#f3f4f6"
          };${highlight ? "border:1px solid #86efac;" : ""}">
            <div style="font-size:12px;color:#6b7280">${escapeHtml(m.fromMe ? "Você" : contactName)} · ${escapeHtml(formatDate(m.timestamp))}</div>
            <div style="white-space:pre-wrap;word-break:break-word">${escapeHtml(messageText(m))}</div>
          </div>
        </div>`;

    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f9fafb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827">
<div style="max-width:640px;margin:0 auto;padding:20px">
  <div style="font-size:13px;color:#6b7280;margin-bottom:8px">${escapeHtml(appName)} · ${escapeHtml(message.fromMe ? "mensagem enviada" : "mensagem recebida")}</div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px">
    ${bubble(message, true)}
    ${attachmentNote ? `<p style="font-size:12px;color:#b45309">${escapeHtml(attachmentNote)}</p>` : ""}
  </div>
  <h3 style="font-size:15px;margin:20px 0 8px">Contato</h3>
  <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:12px;font-size:14px">${rows.map(rowHtml).join("")}</table>
  ${history.length ? `<h3 style="font-size:15px;margin:20px 0 8px">Últimas ${history.length} mensagens</h3>
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px">${history.map((m) => bubble(m, false)).join("")}</div>` : ""}
  ${chatUrl ? `<p style="margin-top:20px"><a href="${escapeHtml(chatUrl)}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px">Abrir conversa no ${escapeHtml(appName)}</a></p>` : ""}
  <p style="font-size:12px;color:#9ca3af;margin-top:24px">Encaminhamento automático do ${escapeHtml(appName)}. Para parar, desative em Automação → Encaminhar por e-mail.</p>
</div></body></html>`;

    const threadId = createHash("sha256").update(`${dbSessionId}:${jid}`).digest("hex").slice(0, 32);
    return { subject, text, html, attachments, threadId };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Forward a newly stored message, if forwarding is enabled for its session. Never throws and never
 * blocks the caller: the e-mail is queued and failures are recorded on the config (lastError).
 */
export function forwardMessageByEmail(message: Message): void {
    const jid = message.remoteJid;
    if (!jid.endsWith("@s.whatsapp.net") && !jid.endsWith("@lid")) return; // private chats only

    getConfig(message.sessionId)
        .then((config) => {
            if (!config?.enabled) return;
            if (message.fromMe && !config.includeOutgoing) return;
            const recipients = parseRecipients(config.recipients).filter(isValidEmail);
            if (!recipients.length) return;

            if (!withinHourlyLimit(config.sessionId)) {
                if (!config.lastError?.startsWith("Limite")) {
                    recordResult(config.sessionId, `Limite de ${MAX_EMAILS_PER_HOUR} e-mails por hora atingido; mensagens ignoradas até a próxima hora.`);
                    configCache.delete(config.sessionId);
                }
                return;
            }

            enqueue(config.sessionId, async () => {
                const send = async () => {
                    const content = await buildEmail(config, message);
                    const transport = await getTransport(config);
                    const appName = (await prisma.systemConfig.findUnique({ where: { id: "default" }, select: { appName: true } }))?.appName || "W-AZAP";
                    await transport.sendMail({
                        from: fromHeader(settingsFromConfig(config), appName),
                        to: recipients,
                        subject: content.subject,
                        text: content.text,
                        html: content.html,
                        attachments: content.attachments,
                        // Same thread for every e-mail of a conversation (clients that thread by References)
                        references: `<conversa.${content.threadId}@w-azap>`,
                        inReplyTo: `<conversa.${content.threadId}@w-azap>`,
                    });
                };

                try {
                    await send();
                    await recordResult(config.sessionId, null);
                } catch (first) {
                    const { code, message: detail } = describeSmtpError(first);
                    // Credentials or recipients will not fix themselves: only retry network/unknown failures
                    if (code === "connection" || code === "unknown") {
                        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
                        invalidateEmailForward(config.sessionId);
                        try {
                            await send();
                            await recordResult(config.sessionId, null);
                            return;
                        } catch (second) {
                            const retried = describeSmtpError(second);
                            logger.error("EmailForward", `Failed to forward message ${message.keyId}: ${retried.message}`);
                            await recordResult(config.sessionId, retried.message);
                            return;
                        }
                    }
                    logger.error("EmailForward", `Failed to forward message ${message.keyId}: ${detail}`);
                    await recordResult(config.sessionId, detail);
                }
            });
        })
        .catch((e) => logger.error("EmailForward", "Could not load the e-mail forwarding config", e));
}

/** Send a sample e-mail with the given settings; throws with a translatable code on failure. */
export async function sendTestEmail(settings: SmtpSettings, recipients: string[], appName: string) {
    const transport = await createSmtpTransport(settings);
    try {
        await transport.verify();
        await transport.sendMail({
            from: fromHeader(settings, appName),
            to: recipients,
            subject: `[${appName}] E-mail de teste do encaminhamento`,
            text: `Tudo certo! O ${appName} consegue enviar e-mails por ${settings.host}:${settings.port}.\n\nCom o encaminhamento ativado, cada nova mensagem das conversas privadas chega aqui com os dados do contato.`,
            html: `<p>Tudo certo! O <strong>${escapeHtml(appName)}</strong> consegue enviar e-mails por <code>${escapeHtml(settings.host)}:${settings.port}</code>.</p><p>Com o encaminhamento ativado, cada nova mensagem das conversas privadas chega aqui com os dados do contato.</p>`,
        });
    } finally {
        transport.close();
    }
}
