import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, isSessionOwner } from "@/lib/api-auth";
import { MAX_CONTEXT_MESSAGES, MAX_RECIPIENTS, isValidEmail, parseRecipients } from "@/lib/email-forward";

/** Body accepted by both "save" and "send test". The password is write-only: omit or send the mask to keep it. */
export const emailForwardSchema = z.object({
    enabled: z.boolean().default(false),
    recipients: z.string().max(2000).default(""),
    includeOutgoing: z.boolean().default(false),
    attachMedia: z.boolean().default(true),
    contextMessages: z.number().int().min(0).max(MAX_CONTEXT_MESSAGES).default(5),
    smtpHost: z.string().trim().max(253).regex(/^[a-zA-Z0-9.:-]*$/, "Servidor SMTP inválido").default(""),
    smtpPort: z.number().int().min(1).max(65535).default(587),
    smtpSecure: z.boolean().default(false),
    smtpUser: z.string().trim().max(254).optional().nullable(),
    smtpPass: z.string().max(500).optional().nullable(),
    fromAddress: z.string().trim().max(254).optional().nullable(),
});

export type EmailForwardInput = z.infer<typeof emailForwardSchema>;

type Fail = { error: NextResponse };
type Ok<T> = { error?: undefined } & T;

const fail = (status: number, message: string, extra: Record<string, unknown> = {}): Fail => ({
    error: NextResponse.json({ status: false, message, error: message, ...extra }, { status }),
});

/**
 * Only the session owner (or a SUPERADMIN) may read or change where conversations are forwarded:
 * shared users could otherwise send every chat of the number to their own mailbox.
 */
export async function authorizeOwner(
    request: NextRequest,
    sessionId: string,
    options: { allowApiKey?: boolean } = {},
): Promise<Fail | Ok<{ dbSessionId: string }>> {
    const user = await getAuthenticatedUser(request, options);
    if (!user) return fail(401, "Não autorizado");
    if (!(await isSessionOwner(user.id, user.role, sessionId))) {
        return fail(403, "Apenas o dono da sessão pode configurar o encaminhamento por e-mail");
    }
    const session = await prisma.session.findUnique({ where: { sessionId }, select: { id: true } });
    if (!session) return fail(404, "Sessão não encontrada");
    return { dbSessionId: session.id };
}

/** Parse and validate the body; returns the normalized input and recipient list. */
export async function parseEmailForwardBody(
    request: NextRequest,
    { requireRecipients }: { requireRecipients: boolean },
): Promise<Fail | Ok<{ input: EmailForwardInput; recipients: string[] }>> {
    let raw: unknown;
    try {
        raw = await request.json();
    } catch {
        return fail(400, "Corpo da requisição inválido");
    }
    const parsed = emailForwardSchema.safeParse(raw);
    if (!parsed.success) {
        return fail(400, parsed.error.issues[0]?.message || "Dados inválidos", { field: parsed.error.issues[0]?.path.join(".") });
    }
    const input = parsed.data;
    const recipients = parseRecipients(input.recipients);

    const invalid = recipients.find((email) => !isValidEmail(email));
    if (invalid) return fail(400, `E-mail de destino inválido: ${invalid}`, { field: "recipients" });
    if (recipients.length > MAX_RECIPIENTS) {
        return fail(400, `Informe no máximo ${MAX_RECIPIENTS} e-mails de destino`, { field: "recipients" });
    }
    if (requireRecipients && recipients.length === 0) {
        return fail(400, "Informe ao menos um e-mail de destino", { field: "recipients" });
    }
    if (requireRecipients && !input.smtpHost) {
        return fail(400, "Informe o servidor SMTP", { field: "smtpHost" });
    }
    if (input.fromAddress && !isValidEmail(input.fromAddress)) {
        return fail(400, "Remetente (De) inválido", { field: "fromAddress" });
    }
    return { input, recipients };
}
