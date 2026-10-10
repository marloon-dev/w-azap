/**
 * In-memory guards against floods: one chat can't keep the assistant busy, and one session can't run up
 * an unbounded AI bill. Past the AI budget the assistant keeps working with the menu.
 */

const CHAT_WINDOW_MS = 5 * 60_000;
const CHAT_MAX_MESSAGES = 20;
const AI_WINDOW_MS = 60 * 60_000;

/** AI answers per session per hour (AGENDA_AI_MAX_PER_HOUR, default 300) */
export function aiHourlyBudget(): number {
    return Number(process.env.AGENDA_AI_MAX_PER_HOUR) || 300;
}

const chats = new Map<string, { times: number[]; warned: boolean }>();
const aiTurns = new Map<string, number[]>();

function prune(map: Map<string, unknown>, isStale: (key: string) => boolean) {
    if (map.size < 5000) return;
    for (const key of map.keys()) if (isStale(key)) map.delete(key);
}

/** "ok" to answer, "warn" once when the chat goes over the limit, then "drop" until it calms down. */
export function chatAllowance(key: string, now = Date.now()): "ok" | "warn" | "drop" {
    const entry = chats.get(key) ?? { times: [], warned: false };
    entry.times = entry.times.filter((t) => now - t < CHAT_WINDOW_MS);
    entry.times.push(now);
    if (entry.times.length <= CHAT_MAX_MESSAGES) entry.warned = false;
    chats.set(key, entry);
    prune(chats, (k) => (chats.get(k)?.times.every((t) => now - t >= CHAT_WINDOW_MS) ?? true));

    if (entry.times.length <= CHAT_MAX_MESSAGES) return "ok";
    if (entry.warned) return "drop";
    entry.warned = true;
    return "warn";
}

/** Takes one AI answer from the session's hourly budget; false when it's spent. */
export function takeAiTurn(dbSessionId: string, now = Date.now()): boolean {
    const times = (aiTurns.get(dbSessionId) ?? []).filter((t) => now - t < AI_WINDOW_MS);
    if (times.length >= aiHourlyBudget()) {
        aiTurns.set(dbSessionId, times);
        return false;
    }
    times.push(now);
    aiTurns.set(dbSessionId, times);
    prune(aiTurns, (k) => (aiTurns.get(k)?.every((t) => now - t >= AI_WINDOW_MS) ?? true));
    return true;
}

/** Tests only */
export function resetLimits() {
    chats.clear();
    aiTurns.clear();
}
