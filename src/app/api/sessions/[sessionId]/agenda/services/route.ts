import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeAgenda, ok, parseBody, serverError } from "../shared";
import { serviceSchema } from "../schemas";

export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    try {
        const auth = await authorizeAgenda(request, sessionId);
        if (auth.error) return auth.error;
        const services = await prisma.agendaService.findMany({
            where: { sessionId: auth.dbSessionId },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            include: { professionals: { select: { professionalId: true } }, _count: { select: { appointments: true } } },
        });
        return ok(
            "Serviços carregados",
            services.map(({ professionals, _count, ...service }) => ({
                ...service,
                professionalIds: professionals.map((p) => p.professionalId),
                appointmentCount: _count.appointments,
            })),
        );
    } catch (error) {
        return serverError("List services", error);
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    try {
        const auth = await authorizeAgenda(request, sessionId);
        if (auth.error) return auth.error;
        const body = await parseBody(request, serviceSchema);
        if (body.error) return body.error;
        const { professionalIds, ...data } = body.data;

        const owned = professionalIds?.length
            ? await prisma.agendaProfessional.findMany({ where: { id: { in: professionalIds }, sessionId: auth.dbSessionId }, select: { id: true } })
            : [];
        const service = await prisma.agendaService.create({
            data: {
                ...data,
                description: data.description || null,
                priceCents: data.priceCents ?? null,
                sessionId: auth.dbSessionId,
                professionals: { create: owned.map((p) => ({ professionalId: p.id })) },
            },
        });
        return ok("Serviço criado", service, 201);
    } catch (error) {
        return serverError("Create service", error);
    }
}
