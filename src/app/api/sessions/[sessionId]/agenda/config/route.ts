import { NextRequest } from "next/server";
import { Prisma, type AgendaConfig } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isSessionOwner } from "@/lib/api-auth";
import { isHttpUrl } from "@/lib/safe-fetch";
import { AI_KEY_MASK, SLOT_STEPS, encryptAiKey, invalidateAgendaConfig } from "@/lib/agenda/config";
import { isValidTimezone } from "@/lib/agenda/time";
import { authorizeAgenda, reject, ok, parseBody, serverError } from "../shared";

const configSchema = z.object({
    enabled: z.boolean(),
    businessName: z.string().trim().max(120),
    businessInfo: z.string().trim().max(4000).nullable().optional(),
    timezone: z.string().refine(isValidTimezone, "Fuso horário inválido"),
    slotStep: z.number().int().refine((v) => (SLOT_STEPS as readonly number[]).includes(v), "Intervalo inválido"),
    minAdvanceMinutes: z.number().int().min(0).max(10080),
    maxAdvanceDays: z.number().int().min(1).max(365),
    cancelMinHours: z.number().int().min(0).max(168),
    triggerMode: z.enum(["ALL", "KEYWORD"]),
    triggerKeyword: z.string().trim().max(40),
    humanPauseHours: z.number().int().min(0).max(168),
    reminderEnabled: z.boolean(),
    reminderHours: z.number().int().min(1).max(72),
    notifyProfessional: z.boolean(),
    aiEnabled: z.boolean(),
    aiBaseUrl: z.string().trim().max(500).nullable().optional(),
    aiApiKey: z.string().max(500).nullable().optional(),
    aiModel: z.string().trim().max(120).nullable().optional(),
    aiInstructions: z.string().trim().max(4000).nullable().optional(),
});


/** Public shape: the AI key never leaves the server, a mask says one is stored. */
function present(config: AgendaConfig | null, canEdit: boolean) {
    return {
        configured: !!config,
        canEdit,
        enabled: config?.enabled ?? false,
        businessName: config?.businessName ?? "",
        businessInfo: config?.businessInfo ?? "",
        timezone: config?.timezone ?? "America/Sao_Paulo",
        slotStep: config?.slotStep ?? 15,
        minAdvanceMinutes: config?.minAdvanceMinutes ?? 60,
        maxAdvanceDays: config?.maxAdvanceDays ?? 30,
        cancelMinHours: config?.cancelMinHours ?? 2,
        triggerMode: config?.triggerMode ?? "ALL",
        triggerKeyword: config?.triggerKeyword ?? "agendar",
        humanPauseHours: config?.humanPauseHours ?? 12,
        reminderEnabled: config?.reminderEnabled ?? true,
        reminderHours: config?.reminderHours ?? 24,
        notifyProfessional: config?.notifyProfessional ?? true,
        aiEnabled: config?.aiEnabled ?? false,
        aiBaseUrl: config?.aiBaseUrl ?? "",
        aiApiKey: config?.aiApiKey ? AI_KEY_MASK : "",
        aiModel: config?.aiModel ?? "",
        aiInstructions: config?.aiInstructions ?? "",
        aiLastError: config?.aiLastError ?? null,
        aiLastErrorAt: config?.aiLastErrorAt ?? null,
        updatedAt: config?.updatedAt ?? null,
    };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    try {
        const auth = await authorizeAgenda(request, sessionId);
        if (auth.error) return auth.error;
        const config = await prisma.agendaConfig.findUnique({ where: { sessionId: auth.dbSessionId } });
        const canEdit = await isSessionOwner(auth.user.id, auth.user.role, sessionId);
        return ok("Configuração da agenda carregada", present(config, canEdit));
    } catch (error) {
        return serverError("Get config", error);
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    try {
        // Where the AI key goes is decided in the browser by the owner, never through an API key
        const auth = await authorizeAgenda(request, sessionId, { ownerOnly: true, allowApiKey: false });
        if (auth.error) return auth.error;
        const body = await parseBody(request, configSchema);
        if (body.error) return body.error;
        const input = body.data;

        if (input.aiBaseUrl && !isHttpUrl(input.aiBaseUrl)) return reject(400, "Endereço da IA inválido (use http:// ou https://)", { field: "aiBaseUrl" });
        if (input.aiEnabled && (!input.aiBaseUrl || !input.aiModel)) {
            return reject(400, "Para ativar a IA, informe o endereço e o modelo", { field: input.aiBaseUrl ? "aiModel" : "aiBaseUrl" });
        }
        if (input.triggerMode === "KEYWORD" && !input.triggerKeyword) return reject(400, "Informe a palavra-chave", { field: "triggerKeyword" });

        // Mask or undefined keeps the stored key; an empty string removes it
        const aiApiKey =
            input.aiApiKey === undefined || input.aiApiKey === AI_KEY_MASK
                ? undefined
                : input.aiApiKey
                    ? encryptAiKey(auth.dbSessionId, input.aiApiKey.trim())
                    : Prisma.DbNull;

        const data = {
            enabled: input.enabled,
            businessName: input.businessName,
            businessInfo: input.businessInfo || null,
            timezone: input.timezone,
            slotStep: input.slotStep,
            minAdvanceMinutes: input.minAdvanceMinutes,
            maxAdvanceDays: input.maxAdvanceDays,
            cancelMinHours: input.cancelMinHours,
            triggerMode: input.triggerMode,
            triggerKeyword: input.triggerKeyword || "agendar",
            humanPauseHours: input.humanPauseHours,
            reminderEnabled: input.reminderEnabled,
            reminderHours: input.reminderHours,
            notifyProfessional: input.notifyProfessional,
            aiEnabled: input.aiEnabled,
            aiBaseUrl: input.aiBaseUrl || null,
            aiModel: input.aiModel || null,
            aiInstructions: input.aiInstructions || null,
            ...(aiApiKey !== undefined ? { aiApiKey } : {}),
        };
        const config = await prisma.agendaConfig.upsert({
            where: { sessionId: auth.dbSessionId },
            create: { sessionId: auth.dbSessionId, ...data },
            update: data,
        });
        invalidateAgendaConfig(auth.dbSessionId);
        return ok("Configuração da agenda salva", present(config, true));
    } catch (error) {
        return serverError("Save config", error);
    }
}
