import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatPhoneFromJid } from "@/lib/agenda/format";
import { authorizeAgenda, ok, reject, serverError } from "../shared";

/** Chats where a person took over: the assistant stays quiet there until `pausedUntil`. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    try {
        const auth = await authorizeAgenda(request, sessionId);
        if (auth.error) return auth.error;
        const paused = await prisma.agendaConversation.findMany({
            where: { sessionId: auth.dbSessionId, pausedUntil: { gt: new Date() } },
            orderBy: { pausedUntil: "desc" },
            select: { jid: true, pausedUntil: true, updatedAt: true },
            take: 200,
        });
        const contacts = await prisma.contact.findMany({
            where: { sessionId: auth.dbSessionId, jid: { in: paused.map((c) => c.jid) } },
            select: { jid: true, name: true, notify: true, verifiedName: true },
        });
        const nameOf = new Map(contacts.map((c) => [c.jid, c.name || c.verifiedName || c.notify || null]));
        return ok(
            "Conversas pausadas",
            paused.map((c) => ({ ...c, name: nameOf.get(c.jid) ?? null, phone: formatPhoneFromJid(c.jid) })),
        );
    } catch (error) {
        return serverError("List paused chats", error);
    }
}

/** Hands a chat back to the assistant (?jid=…). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    try {
        const auth = await authorizeAgenda(request, sessionId);
        if (auth.error) return auth.error;
        const jid = request.nextUrl.searchParams.get("jid");
        if (!jid || jid.length > 200) return reject(400, "Informe a conversa");
        const result = await prisma.agendaConversation.updateMany({ where: { sessionId: auth.dbSessionId, jid }, data: { pausedUntil: null } });
        if (result.count === 0) return reject(404, "Conversa não encontrada");
        return ok("Assistente retomado nesta conversa");
    } catch (error) {
        return serverError("Resume chat", error);
    }
}
