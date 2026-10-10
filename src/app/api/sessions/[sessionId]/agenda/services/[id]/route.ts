import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeAgenda, reject, ok, parseBody, serverError } from "../../shared";
import { serviceSchema } from "../../schemas";

type Params = { params: Promise<{ sessionId: string; id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
    const { sessionId, id } = await params;
    try {
        const auth = await authorizeAgenda(request, sessionId);
        if (auth.error) return auth.error;
        const body = await parseBody(request, serviceSchema.partial());
        if (body.error) return body.error;
        const { professionalIds, ...data } = body.data;

        const existing = await prisma.agendaService.findFirst({ where: { id, sessionId: auth.dbSessionId }, select: { id: true } });
        if (!existing) return reject(404, "Serviço não encontrado");

        const service = await prisma.$transaction(async (tx) => {
            if (professionalIds) {
                const owned = await tx.agendaProfessional.findMany({ where: { id: { in: professionalIds }, sessionId: auth.dbSessionId }, select: { id: true } });
                await tx.agendaProfessionalService.deleteMany({ where: { serviceId: id } });
                await tx.agendaProfessionalService.createMany({ data: owned.map((p) => ({ serviceId: id, professionalId: p.id })) });
            }
            return tx.agendaService.update({
                where: { id },
                data: {
                    ...data,
                    ...(data.description !== undefined ? { description: data.description || null } : {}),
                },
            });
        });
        return ok("Serviço atualizado", service);
    } catch (error) {
        return serverError("Update service", error);
    }
}

export async function DELETE(request: NextRequest, { params }: Params) {
    const { sessionId, id } = await params;
    try {
        const auth = await authorizeAgenda(request, sessionId);
        if (auth.error) return auth.error;
        const service = await prisma.agendaService.findFirst({
            where: { id, sessionId: auth.dbSessionId },
            select: { id: true, _count: { select: { appointments: true } } },
        });
        if (!service) return reject(404, "Serviço não encontrado");
        // History keeps pointing at the service: deactivate instead of deleting
        if (service._count.appointments > 0) {
            return reject(409, "Este serviço tem agendamentos no histórico. Desative-o em vez de excluir.", { code: "HAS_APPOINTMENTS" });
        }
        await prisma.agendaService.delete({ where: { id } });
        return ok("Serviço excluído");
    } catch (error) {
        return serverError("Delete service", error);
    }
}
