import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { SMTP_PASSWORD_MASK, decryptSmtpPassword, describeSmtpError, sendTestEmail } from "@/lib/email-forward";
import { authorizeOwner, parseEmailForwardBody } from "../shared";

/**
 * Send a test e-mail using the settings in the body (they do not need to be saved first).
 * When the password is omitted or masked, the stored one is used.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    try {
        const auth = await authorizeOwner(request, sessionId, { allowApiKey: false });
        if (auth.error) return auth.error;

        const body = await parseEmailForwardBody(request, { requireRecipients: true });
        if (body.error) return body.error;
        const { input, recipients } = body;

        let pass = input.smtpPass ?? null;
        if (pass === null || pass === SMTP_PASSWORD_MASK) {
            const stored = await prisma.emailForward.findUnique({ where: { sessionId: auth.dbSessionId }, select: { smtpPass: true } });
            pass = decryptSmtpPassword(auth.dbSessionId, stored?.smtpPass);
        }

        const appName = (await prisma.systemConfig.findUnique({ where: { id: "default" }, select: { appName: true } }))?.appName || "W-AZAP";

        try {
            await sendTestEmail(
                { host: input.smtpHost, port: input.smtpPort, secure: input.smtpSecure, user: input.smtpUser, pass, from: input.fromAddress },
                recipients,
                appName,
            );
        } catch (error) {
            const { code, message } = describeSmtpError(error);
            logger.warn("EmailForward", `Test e-mail failed for session ${sessionId}: ${message}`);
            return NextResponse.json({ status: false, message, error: message, code }, { status: 502 });
        }

        return NextResponse.json({ status: true, message: `E-mail de teste enviado para ${recipients.join(", ")}` });
    } catch (error) {
        logger.error("EmailForward", "Test e-mail error", error);
        return NextResponse.json({ status: false, message: "Erro interno do servidor", error: "Erro interno do servidor" }, { status: 500 });
    }
}
