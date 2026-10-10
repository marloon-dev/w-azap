import type { AgendaConfig } from "@prisma/client";
import { normalizeMessageContent, type WAMessage, type WASocket } from "@whiskeysockets/baileys";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isLidJid, normalizeJid, resolveToPhoneJid } from "@/lib/jid-utils";
import { canAutoReply, ruleMatches } from "@/modules/whatsapp/store/autoreply";
import { aiReady, getAgendaConfig } from "../config";
import { normalizeText } from "../format";
import { sendText, wasSentByAssistant } from "../notify";
import { AiError, handleWithAi } from "./ai";
import { inChatQueue, isActive, loadConversation, saveConversation, type Conversation } from "./conversation";
import { handleMenu, handleReminderReply } from "./menu";
import type { Turn } from "./types";

const PRIVATE_CHAT = /@(s\.whatsapp\.net|lid)$/;

function messageText(msg: WAMessage): string {
    const content = normalizeMessageContent(msg.message);
    return (
        content?.conversation ||
        content?.extendedTextMessage?.text ||
        content?.imageMessage?.caption ||
        content?.videoMessage?.caption ||
        ""
    ).trim();
}

/** Routes one message: reminder answer → menu in progress → AI (falls back to the menu) → menu. */
async function processTurn(turn: Turn) {
    const state = turn.conversation.state;
    if (state?.step === "reminder") {
        if (await handleReminderReply(turn, state.appointmentId)) return;
        turn.conversation.state = null;
        await saveConversation(turn.dbSessionId, turn.customerJid, { state: null }, turn.now);
    }

    // A menu already on screen (fallback or reminder flow) finishes as a menu
    if (aiReady(turn.config) && !turn.conversation.state) {
        try {
            await handleWithAi(turn);
            if (turn.config.aiLastError) {
                await prisma.agendaConfig.update({ where: { id: turn.config.id }, data: { aiLastError: null, aiLastErrorAt: null } });
            }
            return;
        } catch (error) {
            if (!(error instanceof AiError)) throw error;
            logger.warn("Agenda", `AI failed, falling back to the menu: ${error.message}`);
            await prisma.agendaConfig.update({ where: { id: turn.config.id }, data: { aiLastError: error.message.slice(0, 1000), aiLastErrorAt: new Date() } });
        }
    }
    await handleMenu(turn);
}

/** Auto-reply rules or bot commands already answer this text: stay out of the way. */
async function handledElsewhere(dbSessionId: string, text: string, senderJid: string) {
    const botConfig = await prisma.botConfig.findUnique({ where: { sessionId: dbSessionId } });
    if (!botConfig?.enabled) return false;
    if (text.startsWith(botConfig.prefix || "#")) return true;
    if (!canAutoReply(botConfig, false, senderJid)) return false;
    const rules = await prisma.autoReply.findMany({ where: { sessionId: dbSessionId }, select: { keyword: true, matchType: true, triggerType: true } });
    return rules.some((rule) => ruleMatches(rule, text, false));
}

function shouldStart(config: AgendaConfig, conversation: Conversation, text: string) {
    if (config.triggerMode !== "KEYWORD" || isActive(conversation)) return true;
    const keyword = normalizeText(config.triggerKeyword);
    return !!keyword && normalizeText(text).includes(keyword);
}

/**
 * Entry point from the message store, for every new message of a session.
 * Outgoing messages the assistant didn't send mean a person answered: the assistant pauses in that chat.
 */
export async function handleAgendaMessage(sock: WASocket, dbSessionId: string, msg: WAMessage, type: string) {
    const remoteJid = msg.key.remoteJid;
    if (!remoteJid || !PRIVATE_CHAT.test(remoteJid) || !msg.message) return;

    const config = await getAgendaConfig(dbSessionId);
    if (!config?.enabled) return;

    const customerJid = normalizeJid(isLidJid(remoteJid) ? await resolveToPhoneJid(remoteJid, dbSessionId, msg.key.remoteJidAlt) : remoteJid);

    if (msg.key.fromMe) {
        if (wasSentByAssistant(msg.key.id) || config.humanPauseHours <= 0) return;
        // Ignore our own echo of reactions/receipts: only real content counts as a takeover
        if (!messageText(msg) && !normalizeMessageContent(msg.message)?.imageMessage && !normalizeMessageContent(msg.message)?.audioMessage) return;
        const pausedUntil = new Date(Date.now() + config.humanPauseHours * 3_600_000);
        await saveConversation(dbSessionId, customerJid, { state: null, pausedUntil });
        logger.info("Agenda", `A person answered ${customerJid}; assistant paused until ${pausedUntil.toISOString()}`);
        return;
    }
    if (type !== "notify") return;

    await inChatQueue(`${dbSessionId}:${customerJid}`, async () => {
        const now = new Date();
        const conversation = await loadConversation(dbSessionId, customerJid, now);
        if (conversation.pausedUntil) return;

        const text = messageText(msg);
        if (!text) {
            if (isActive(conversation)) await sendText(sock, remoteJid, "Por enquanto eu só entendo mensagens de texto. 🙂");
            return;
        }
        if (!shouldStart(config, conversation, text)) return;
        if (!isActive(conversation) && (await handledElsewhere(dbSessionId, text, customerJid))) return;

        await processTurn({
            dbSessionId,
            config,
            customerJid,
            customerName: msg.pushName?.trim() || null,
            text,
            now,
            conversation,
            reply: async (reply) => {
                await sendText(sock, remoteJid, reply);
            },
        });
    });
}

/** Panel simulator: same assistant, replies are returned instead of sent. Bookings made here are real. */
export async function simulateAgendaMessage(input: { dbSessionId: string; userId: string; userName: string | null; text: string; reset?: boolean; now?: Date }) {
    const customerJid = `simulador-${input.userId}@agenda.local`;
    if (input.reset) {
        await prisma.agendaConversation.deleteMany({ where: { sessionId: input.dbSessionId, jid: customerJid } });
    }
    const config = await prisma.agendaConfig.findUnique({ where: { sessionId: input.dbSessionId } });
    if (!config) return { replies: [] as string[], paused: false };

    return inChatQueue(`${input.dbSessionId}:${customerJid}`, async () => {
        const now = input.now ?? new Date();
        const conversation = await loadConversation(input.dbSessionId, customerJid, now);
        if (conversation.pausedUntil) return { replies: [] as string[], paused: true };
        if (!input.text.trim()) return { replies: [] as string[], paused: false };

        const replies: string[] = [];
        await processTurn({
            dbSessionId: input.dbSessionId,
            config,
            customerJid,
            customerName: input.userName,
            text: input.text.trim().slice(0, 2000),
            now,
            conversation,
            reply: async (reply) => {
                replies.push(reply);
            },
        });
        return { replies, paused: !!conversation.pausedUntil };
    });
}

export const SIMULATOR_JID_SUFFIX = "@agenda.local";
