import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/agenda/format";
import { authorizeAgenda, reject, ok, parseBody, serverError, toMinute } from "../../shared";
import { professionalSchema } from "../../schemas";
import { presentProfessional, professionalInclude } from "../../present";

type Params = { params: Promise<{ sessionId: string; id: string }> };

/** Replaces the professional, including services and the weekly hours (the panel always sends the whole form). */
export async function PUT(request: NextRequest, { params }: Params) {
    const { sessionId, id } = await params;
    try {
        const auth = await authorizeAgenda(request, sessionId);
        if (auth.error) return auth.error;
        const body = await parseBody(request, professionalSchema);
        if (body.error) return body.error;
        const input = body.data;

        const existing = await prisma.agendaProfessional.findFirst({ where: { id, sessionId: auth.dbSessionId }, select: { id: true } });
        if (!existing) return reject(404, "Profissional não encontrado");
        const phone = input.phone ? normalizePhone(input.phone) : null;
        if (input.phone && !phone) return reject(400, "WhatsApp inválido: use DDI + DDD + número", { field: "phone" });

        const services = await prisma.agendaService.findMany({ where: { id: { in: input.serviceIds }, sessionId: auth.dbSessionId }, select: { id: true } });
        const professional = await prisma.$transaction(async (tx) => {
            await tx.agendaProfessionalService.deleteMany({ where: { professionalId: id } });
            await tx.agendaWorkingHour.deleteMany({ where: { professionalId: id } });
            return tx.agendaProfessional.update({
                where: { id },
                data: {
                    name: input.name,
                    phone,
                    active: input.active,
                    sortOrder: input.sortOrder,
                    services: { create: services.map((s) => ({ serviceId: s.id })) },
                    hours: { create: input.hours.map((h) => ({ weekday: h.weekday, startMinute: toMinute(h.start), endMinute: toMinute(h.end) })) },
                },
                include: professionalInclude,
            });
        });
        return ok("Profissional atualizado", presentProfessional(professional));
    } catch (error) {
        return serverError("Update professional", error);
    }
}

export async function DELETE(request: NextRequest, { params }: Params) {
    const { sessionId, id } = await params;
    try {
        const auth = await authorizeAgenda(request, sessionId);
        if (auth.error) return auth.error;
        const professional = await prisma.agendaProfessional.findFirst({
            where: { id, sessionId: auth.dbSessionId },
            select: { id: true, _count: { select: { appointments: true } } },
        });
        if (!professional) return reject(404, "Profissional não encontrado");
        if (professional._count.appointments > 0) {
            return reject(409, "Este profissional tem agendamentos no histórico. Desative-o em vez de excluir.", { code: "HAS_APPOINTMENTS" });
        }
        await prisma.agendaProfessional.delete({ where: { id } });
        return ok("Profissional excluído");
    } catch (error) {
        return serverError("Delete professional", error);
    }
}
