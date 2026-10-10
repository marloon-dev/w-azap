import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isHttpUrl } from "@/lib/safe-fetch";
import { AI_KEY_MASK, decryptAiKey } from "@/lib/agenda/config";
import { AiError, aiAllowsPrivate, testAi } from "@/lib/agenda/assistant/ai";
import { authorizeAgenda, originOf, reject, ok, parseBody, serverError } from "../../shared";

const testSchema = z.object({
    aiBaseUrl: z.string().trim().min(1, "Informe o endereço da IA").max(500),
    aiApiKey: z.string().max(500).nullable().optional(),
    aiModel: z.string().trim().min(1, "Informe o modelo").max(120),
});

/** Sends one short prompt with the values on screen (the stored key is used while the field shows the mask). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    try {
        const auth = await authorizeAgenda(request, sessionId, { ownerOnly: true, allowApiKey: false });
        if (auth.error) return auth.error;
        const body = await parseBody(request, testSchema);
        if (body.error) return body.error;
        const input = body.data;
        if (!isHttpUrl(input.aiBaseUrl)) return reject(400, "Endereço da IA inválido (use http:// ou https://)", { field: "aiBaseUrl" });

        let apiKey = input.aiApiKey?.trim() || null;
        if (apiKey === AI_KEY_MASK) {
            const config = await prisma.agendaConfig.findUnique({ where: { sessionId: auth.dbSessionId }, select: { sessionId: true, aiApiKey: true, aiBaseUrl: true } });
            // The saved key is only sent to the address it was saved with
            if (config?.aiApiKey && originOf(config.aiBaseUrl) !== originOf(input.aiBaseUrl)) {
                return reject(400, "Você trocou o endereço da IA: informe a chave da API de novo", { field: "aiApiKey", code: "KEY_REQUIRED" });
            }
            apiKey = config ? decryptAiKey(config) : null;
        }

        try {
            const result = await testAi({ baseUrl: input.aiBaseUrl, apiKey, model: input.aiModel, allowPrivate: await aiAllowsPrivate(auth.dbSessionId) });
            return ok("A IA respondeu", result);
        } catch (error) {
            if (error instanceof AiError) return reject(502, error.message, { code: error.code });
            throw error;
        }
    } catch (error) {
        return serverError("Test AI", error);
    }
}
