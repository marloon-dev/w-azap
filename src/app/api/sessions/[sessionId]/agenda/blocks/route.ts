import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeAgenda, reject, ok, parseBody, serverError } from "../shared";
import { blockSchema } from "../schemas";

/** Upcoming and current blocks (?past=1 includes the last 90 days). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    try {
        const auth = await authorizeAgenda(request, sessionId);
        if (auth.error) return auth.error;
        const past = request.nextUrl.searchParams.get("past") === "1";
        const since = new Date(Date.now() - (past ? 90 * 86_400_000 : 0));
        const blocks = await prisma.agendaBlock.findMany({
            where: { sessionId: auth.dbSessionId, endsAt: { gt: since } },
            orderBy: { startsAt: "asc" },
            include: { professional: { select: { id: true, name: true } } },
            take: 500,
        });
        return ok("Bloqueios carregados", blocks);
    } catch (error) {
        return serverError("List blocks", error);
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    try {
        const auth = await authorizeAgenda(request, sessionId);
        if (auth.error) return auth.error;
        const body = await parseBody(request, blockSchema);
        if (body.error) return body.error;
        const input = body.data;

        if (input.professionalId) {
            const professional = await prisma.agendaProfessional.findFirst({ where: { id: input.professionalId, sessionId: auth.dbSessionId }, select: { id: true } });
            if (!professional) return reject(404, "Profissional não encontrado");
        }
        const startsAt = new Date(input.startsAt);
        const endsAt = new Date(input.endsAt);
        const block = await prisma.agendaBlock.create({
            data: { sessionId: auth.dbSessionId, professionalId: input.professionalId || null, startsAt, endsAt, reason: input.reason || null },
            include: { professional: { select: { id: true, name: true } } },
        });

        // Existing appointments are kept: the panel shows them so someone can reschedule
        const conflicts = await prisma.agendaAppointment.count({
            where: {
                sessionId: auth.dbSessionId,
                status: { in: ["BOOKED", "CONFIRMED"] },
                startsAt: { lt: endsAt },
                endsAt: { gt: startsAt },
                ...(input.professionalId ? { professionalId: input.professionalId } : {}),
            },
        });
        return ok("Bloqueio criado", { ...block, conflicts }, 201);
    } catch (error) {
        return serverError("Create block", error);
    }
}
