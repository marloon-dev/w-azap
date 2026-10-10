import type { AgendaConfig } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptString, encryptString, isEncryptedBlob } from "@/lib/data-encryption";
import { logger } from "@/lib/logger";

/** Shown instead of the stored AI key: the key itself never leaves the server. */
export const AI_KEY_MASK = "••••••••";

export const SLOT_STEPS = [5, 10, 15, 20, 30, 60] as const;

/** Rules the availability engine needs (a subset of AgendaConfig, so tests can build one by hand). */
export type AgendaRules = Pick<AgendaConfig, "timezone" | "slotStep" | "minAdvanceMinutes" | "maxAdvanceDays" | "cancelMinHours" | "maxActivePerCustomer">;

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { config: AgendaConfig | null; at: number }>();

/** Config by database session id, cached briefly: it is read for every incoming message. */
export async function getAgendaConfig(dbSessionId: string): Promise<AgendaConfig | null> {
    const hit = cache.get(dbSessionId);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.config;
    const config = await prisma.agendaConfig.findUnique({ where: { sessionId: dbSessionId } });
    cache.set(dbSessionId, { config, at: Date.now() });
    return config;
}

export function invalidateAgendaConfig(dbSessionId: string) {
    cache.delete(dbSessionId);
}

// The session id is bound as AAD: a blob copied to another session's row won't decrypt
export function encryptAiKey(dbSessionId: string, key: string) {
    return encryptString(key, `agenda-ai:${dbSessionId}`) as unknown as object;
}

export function decryptAiKey(config: Pick<AgendaConfig, "sessionId" | "aiApiKey">): string | null {
    if (!isEncryptedBlob(config.aiApiKey)) return null;
    try {
        return decryptString(config.aiApiKey, `agenda-ai:${config.sessionId}`);
    } catch (error) {
        logger.error("Agenda", "Could not decrypt the AI key", error);
        return null;
    }
}

export function aiReady(config: AgendaConfig): boolean {
    return config.aiEnabled && !!config.aiBaseUrl && !!config.aiModel;
}
