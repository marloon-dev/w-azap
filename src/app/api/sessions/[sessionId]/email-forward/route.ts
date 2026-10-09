import { NextRequest, NextResponse } from "next/server";
import { Prisma, type EmailForward } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
    SMTP_PASSWORD_MASK,
    encryptSmtpPassword,
    invalidateEmailForward,
    parseRecipients,
} from "@/lib/email-forward";
import { authorizeOwner, parseEmailForwardBody } from "./shared";

/** Public shape of the config. The stored password never leaves the server: a mask marks that one is set. */
function present(config: EmailForward | null) {
    return {
        configured: !!config,
        enabled: config?.enabled ?? false,
        recipients: config?.recipients ?? "",
        includeOutgoing: config?.includeOutgoing ?? false,
        attachMedia: config?.attachMedia ?? true,
        contextMessages: config?.contextMessages ?? 5,
        smtpHost: config?.smtpHost ?? "",
        smtpPort: config?.smtpPort ?? 587,
        smtpSecure: config?.smtpSecure ?? false,
        smtpUser: config?.smtpUser ?? null,
        smtpPass: config?.smtpPass ? SMTP_PASSWORD_MASK : null,
        fromAddress: config?.fromAddress ?? null,
        sentCount: config?.sentCount ?? 0,
        lastSentAt: config?.lastSentAt ?? null,
        lastError: config?.lastError ?? null,
        lastErrorAt: config?.lastErrorAt ?? null,
        updatedAt: config?.updatedAt ?? null,
    };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    try {
        const auth = await authorizeOwner(request, sessionId);
        if (auth.error) return auth.error;

        const config = await prisma.emailForward.findUnique({ where: { sessionId: auth.dbSessionId } });
        return NextResponse.json({ status: true, message: "Configuração de encaminhamento carregada", data: present(config) });
    } catch (error) {
        logger.error("EmailForward", "Get config error", error);
        return NextResponse.json({ status: false, message: "Erro interno do servidor", error: "Erro interno do servidor" }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    try {
        // Changing where conversations go requires the browser login, not an API key
        const auth = await authorizeOwner(request, sessionId, { allowApiKey: false });
        if (auth.error) return auth.error;

        const body = await parseEmailForwardBody(request, { requireRecipients: false });
        if (body.error) return body.error;
        const { input, recipients } = body;

        if (input.enabled && (!recipients.length || !input.smtpHost)) {
            return NextResponse.json(
                { status: false, message: "Para ativar, informe o servidor SMTP e ao menos um e-mail de destino", error: "Configuração incompleta" },
                { status: 400 },
            );
        }

        // Mask or undefined keeps the stored password; an empty string removes it
        const smtpPass =
            input.smtpPass === undefined || input.smtpPass === SMTP_PASSWORD_MASK
                ? undefined
                : input.smtpPass
                    ? encryptSmtpPassword(auth.dbSessionId, input.smtpPass)
                    : Prisma.DbNull;

        const data = {
            enabled: input.enabled,
            recipients: parseRecipients(input.recipients).join(", "),
            includeOutgoing: input.includeOutgoing,
            attachMedia: input.attachMedia,
            contextMessages: input.contextMessages,
            smtpHost: input.smtpHost,
            smtpPort: input.smtpPort,
            smtpSecure: input.smtpSecure,
            smtpUser: input.smtpUser || null,
            fromAddress: input.fromAddress || null,
        };

        const config = await prisma.emailForward.upsert({
            where: { sessionId: auth.dbSessionId },
            create: { sessionId: auth.dbSessionId, ...data, ...(smtpPass !== undefined ? { smtpPass } : {}) },
            update: { ...data, ...(smtpPass !== undefined ? { smtpPass } : {}) },
        });
        invalidateEmailForward(auth.dbSessionId);

        logger.info("EmailForward", `Config saved for session ${sessionId} (enabled: ${config.enabled})`);
        return NextResponse.json({ status: true, message: "Encaminhamento por e-mail salvo", data: present(config) });
    } catch (error) {
        logger.error("EmailForward", "Save config error", error);
        return NextResponse.json({ status: false, message: "Falha ao salvar o encaminhamento", error: "Falha ao salvar o encaminhamento" }, { status: 500 });
    }
}
