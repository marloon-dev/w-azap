import { generateMessageIDV2, type WASocket } from "@whiskeysockets/baileys";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { waManager } from "@/modules/whatsapp/manager";

const SENT_ID_TTL_MS = 10 * 60_000;
const sentByAssistant = new Map<string, number>();

/**
 * Messages the assistant sends are tracked by id, so an outgoing message that is NOT in this set is a
 * person answering from the phone or the panel (human takeover). The id is registered before sending,
 * because Baileys emits our own message as an upsert before sendMessage resolves.
 */
export function wasSentByAssistant(messageId: string | null | undefined): boolean {
    if (!messageId) return false;
    const expires = sentByAssistant.get(messageId);
    return !!expires && expires > Date.now();
}

function remember(messageId: string) {
    const now = Date.now();
    sentByAssistant.set(messageId, now + SENT_ID_TTL_MS);
    if (sentByAssistant.size > 5000) {
        for (const [id, expires] of sentByAssistant) if (expires <= now) sentByAssistant.delete(id);
    }
}

export async function sendText(sock: WASocket, jid: string, text: string): Promise<boolean> {
    const messageId = generateMessageIDV2(sock.user?.id);
    remember(messageId);
    try {
        await sock.sendMessage(jid, { text }, { messageId });
        return true;
    } catch (error) {
        logger.error("Agenda", `Failed to send a message to ${jid}`, error);
        return false;
    }
}

/** Socket of a connected session, by database session id (null when offline). */
export async function socketForSession(dbSessionId: string): Promise<WASocket | null> {
    const session = await prisma.session.findUnique({ where: { id: dbSessionId }, select: { sessionId: true } });
    if (!session) return null;
    return waManager.getInstance(session.sessionId)?.socket ?? null;
}

export async function sendTextBySession(dbSessionId: string, jid: string, text: string): Promise<boolean> {
    const sock = await socketForSession(dbSessionId);
    if (!sock) {
        logger.warn("Agenda", `Session ${dbSessionId} is offline; message to ${jid} not sent`);
        return false;
    }
    return sendText(sock, jid, text);
}

/**
 * Customer JID for a number typed in the panel. Brazilian numbers without the country code get 55.
 * When the session is online, WhatsApp tells the canonical JID (some numbers are registered without
 * the ninth digit), so the appointment matches the chat the customer will write from.
 */
export async function customerJidFromPhone(dbSessionId: string, phone: string): Promise<string | null> {
    let digits = phone.replace(/\D/g, "").replace(/^0+/, "");
    if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
    if (digits.length < 8 || digits.length > 15) return null;
    const sock = await socketForSession(dbSessionId);
    if (sock) {
        try {
            const [result] = (await sock.onWhatsApp(digits)) ?? [];
            if (result?.exists && result.jid) return result.jid;
        } catch (error) {
            logger.warn("Agenda", `onWhatsApp lookup failed for ${digits}`, error);
        }
    }
    return `${digits}@s.whatsapp.net`;
}
