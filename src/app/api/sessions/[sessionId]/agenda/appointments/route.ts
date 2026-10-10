import { NextRequest } from "next/server";
import type { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bookAppointment } from "@/lib/agenda/booking";
import { formatPhoneFromJid } from "@/lib/agenda/format";
import { customerJidFromPhone } from "@/lib/agenda/notify";
import { addDays, dayBounds, todayIn } from "@/lib/agenda/time";
import { authorizeAgenda, reject, ok, parseBody, rulesFor, serverError } from "../shared";
import { createAppointmentSchema, daySchema } from "../schemas";

const MAX_RANGE_DAYS = 62;
const STATUSES = ["BOOKED", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"];

/** Appointments between two days (inclusive, business timezone). Defaults to today. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    try {
        const auth = await authorizeAgenda(request, sessionId);
        if (auth.error) return auth.error;
        const rules = await rulesFor(auth.dbSessionId);
        const search = request.nextUrl.searchParams;
        const today = todayIn(rules.timezone);
        const from = search.get("from") || today;
        const to = search.get("to") || from;
        if (!daySchema.safeParse(from).success || !daySchema.safeParse(to).success || to < from) return reject(400, "Período inválido");
        if (to > addDays(from, MAX_RANGE_DAYS)) return reject(400, `Período máximo de ${MAX_RANGE_DAYS} dias`);

        const professionalId = search.get("professionalId");
        const status = search.get("status");
        const appointments = await prisma.agendaAppointment.findMany({
            where: {
                sessionId: auth.dbSessionId,
                startsAt: { gte: dayBounds(from, rules.timezone).start, lt: dayBounds(to, rules.timezone).end },
                ...(professionalId ? { professionalId } : {}),
                ...(status && STATUSES.includes(status) ? { status: status as AppointmentStatus } : {}),
            },
            orderBy: { startsAt: "asc" },
            include: {
                service: { select: { id: true, name: true, durationMinutes: true } },
                professional: { select: { id: true, name: true } },
            },
            take: 2000,
        });
        return ok("Agendamentos carregados", {
            timezone: rules.timezone,
            today,
            appointments: appointments.map((a) => ({ ...a, customerPhone: formatPhoneFromJid(a.customerJid) })),
        });
    } catch (error) {
        return serverError("List appointments", error);
    }
}

/** Booking made by the team: ignores working hours and notice rules, never overlaps another appointment. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    try {
        const auth = await authorizeAgenda(request, sessionId);
        if (auth.error) return auth.error;
        const body = await parseBody(request, createAppointmentSchema);
        if (body.error) return body.error;
        const input = body.data;

        const customerJid = await customerJidFromPhone(auth.dbSessionId, input.customerPhone);
        if (!customerJid) return reject(400, "WhatsApp do cliente inválido", { field: "customerPhone" });

        const appointment = await bookAppointment({
            dbSessionId: auth.dbSessionId,
            rules: await rulesFor(auth.dbSessionId),
            serviceId: input.serviceId,
            professionalId: input.professionalId,
            startsAt: new Date(input.startsAt),
            customerJid,
            customerName: input.customerName,
            notes: input.notes,
            source: "PANEL",
            enforceRules: false,
        });
        return ok("Agendamento criado", appointment, 201);
    } catch (error) {
        return serverError("Create appointment", error);
    }
}
