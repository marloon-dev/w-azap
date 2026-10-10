import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { MenuState } from "./menu";
import type { ChatMessage } from "./ai";

/** A menu left halfway is forgotten after this; the next message starts over. */
const STATE_TTL_MS = 30 * 60_000;
/** A reminder is answered whenever the customer sees it, often hours later. */
const REMINDER_TTL_MS = 48 * 3_600_000;
/** AI context is dropped after a long silence, so an old chat doesn't steer a new one. */
const HISTORY_TTL_MS = 6 * 3_600_000;

export interface Conversation {
    state: MenuState | null;
    history: ChatMessage[];
    pausedUntil: Date | null;
}

interface StoredState {
    at: number;
    value: MenuState;
}

interface StoredHistory {
    at: number;
    messages: ChatMessage[];
}

export async function loadConversation(dbSessionId: string, jid: string, now = new Date()): Promise<Conversation> {
    const row = await prisma.agendaConversation.findUnique({ where: { sessionId_jid: { sessionId: dbSessionId, jid } } });
    const state = row?.state as unknown as StoredState | null;
    const history = row?.history as unknown as StoredHistory | null;
    return {
        state: state?.value && now.getTime() - state.at < (state.value.step === "reminder" ? REMINDER_TTL_MS : STATE_TTL_MS) ? state.value : null,
        history: history && now.getTime() - history.at < HISTORY_TTL_MS ? history.messages : [],
        pausedUntil: row?.pausedUntil && row.pausedUntil > now ? row.pausedUntil : null,
    };
}

export async function saveConversation(
    dbSessionId: string,
    jid: string,
    patch: { state?: MenuState | null; history?: ChatMessage[]; pausedUntil?: Date | null },
    now = new Date(),
) {
    const data: Prisma.AgendaConversationUpdateInput = {};
    if (patch.state !== undefined) {
        data.state = patch.state ? ({ at: now.getTime(), value: patch.state } as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
    }
    if (patch.history !== undefined) data.history = { at: now.getTime(), messages: patch.history } as unknown as Prisma.InputJsonValue;
    if (patch.pausedUntil !== undefined) data.pausedUntil = patch.pausedUntil;

    await prisma.agendaConversation.upsert({
        where: { sessionId_jid: { sessionId: dbSessionId, jid } },
        create: { ...(data as Omit<Prisma.AgendaConversationUncheckedCreateInput, "sessionId" | "jid">), sessionId: dbSessionId, jid },
        update: data,
    });
}

/** True when this chat has talked to the assistant recently (used by the keyword trigger). */
export function isActive(conversation: Conversation): boolean {
    return !!conversation.state || conversation.history.length > 0;
}

const queues = new Map<string, Promise<unknown>>();

/** Messages of one chat are handled one at a time, in order (customers often send several in a row). */
export function inChatQueue<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = queues.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(task);
    queues.set(key, next);
    next.finally(() => {
        if (queues.get(key) === next) queues.delete(key);
    }).catch(() => undefined);
    return next;
}
