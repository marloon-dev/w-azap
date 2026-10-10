import { NextRequest } from "next/server";
import { z } from "zod";
import { simulateAgendaMessage } from "@/lib/agenda/assistant";
import { authorizeAgenda, ok, parseBody, serverError } from "../shared";

const simulateSchema = z.object({
    text: z.string().max(2000).default(""),
    reset: z.boolean().default(false),
});

/** Chat with the assistant from the panel, as a test customer. Bookings made here are real. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    try {
        const auth = await authorizeAgenda(request, sessionId, { allowApiKey: false });
        if (auth.error) return auth.error;
        const body = await parseBody(request, simulateSchema);
        if (body.error) return body.error;

        const result = await simulateAgendaMessage({
            dbSessionId: auth.dbSessionId,
            userId: auth.user.id,
            userName: auth.user.name,
            text: body.data.text,
            reset: body.data.reset,
        });
        return ok("Simulação concluída", result);
    } catch (error) {
        return serverError("Simulate", error);
    }
}
