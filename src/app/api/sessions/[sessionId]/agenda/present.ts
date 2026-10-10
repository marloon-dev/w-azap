import { prisma } from "@/lib/prisma";
import { minuteToTime } from "@/lib/agenda/time";

export const professionalInclude = {
    services: { select: { serviceId: true } },
    hours: { orderBy: [{ weekday: "asc" as const }, { startMinute: "asc" as const }] },
    _count: { select: { appointments: true } },
};

export async function loadProfessionals(dbSessionId: string, id?: string) {
    return prisma.agendaProfessional.findMany({
        where: { sessionId: dbSessionId, ...(id ? { id } : {}) },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: professionalInclude,
    });
}

type ProfessionalRow = Awaited<ReturnType<typeof loadProfessionals>>[number];

/** Working hours travel as "HH:MM" text; the database keeps minutes after midnight. */
export function presentProfessional({ services, hours, _count, ...professional }: ProfessionalRow) {
    return {
        ...professional,
        serviceIds: services.map((s) => s.serviceId),
        hours: hours.map((h) => ({ weekday: h.weekday, start: minuteToTime(h.startMinute), end: minuteToTime(h.endMinute) })),
        appointmentCount: _count.appointments,
    };
}
