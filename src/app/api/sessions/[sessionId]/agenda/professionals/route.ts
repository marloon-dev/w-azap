import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/agenda/format";
import { authorizeAgenda, reject, ok, parseBody, serverError, toMinute } from "../shared";
import { professionalSchema } from "../schemas";
import { loadProfessionals, presentProfessional, professionalInclude } from "../present";

export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    try {
        const auth = await authorizeAgenda(request, sessionId);
        if (auth.error) return auth.error;
        const professionals = await loadProfessionals(auth.dbSessionId);
        return ok("Profissionais carregados", professionals.map(presentProfessional));
    } catch (error) {
        return serverError("List professionals", error);
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    try {
        const auth = await authorizeAgenda(request, sessionId);
        if (auth.error) return auth.error;
        const body = await parseBody(request, professionalSchema);
        if (body.error) return body.error;
        const input = body.data;

        const phone = input.phone ? normalizePhone(input.phone) : null;
        if (input.phone && !phone) return reject(400, "WhatsApp inválido: use DDI + DDD + número", { field: "phone" });

        const services = await prisma.agendaService.findMany({ where: { id: { in: input.serviceIds }, sessionId: auth.dbSessionId }, select: { id: true } });
        const professional = await prisma.agendaProfessional.create({
            data: {
                sessionId: auth.dbSessionId,
                name: input.name,
                phone,
                active: input.active,
                sortOrder: input.sortOrder,
                services: { create: services.map((s) => ({ serviceId: s.id })) },
                hours: { create: input.hours.map((h) => ({ weekday: h.weekday, startMinute: toMinute(h.start), endMinute: toMinute(h.end) })) },
            },
            include: professionalInclude,
        });
        return ok("Profissional cadastrado", presentProfessional(professional), 201);
    } catch (error) {
        return serverError("Create professional", error);
    }
}
