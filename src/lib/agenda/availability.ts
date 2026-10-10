import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AgendaRules } from "./config";
import { addDays, dayBounds, dayMinuteToDate, todayIn, weekdayOf } from "./time";

export type Db = PrismaClient | Prisma.TransactionClient;

/** [start, end) in epoch milliseconds */
export interface Interval {
    start: number;
    end: number;
}

export interface Slot {
    start: Date;
    end: Date;
    professionalId: string;
    professionalName: string;
}

interface ProfessionalData {
    id: string;
    name: string;
    hours: { weekday: number; startMinute: number; endMinute: number }[];
    busy: Interval[];
}

export interface AvailabilityData {
    service: { id: string; name: string; durationMinutes: number; priceCents: number | null };
    professionals: ProfessionalData[];
    /** Business-wide blocks (holidays, closed days) */
    closed: Interval[];
}

/** Appointments in these states hold their time; cancelled ones free it. */
export const ACTIVE_STATUSES = ["BOOKED", "CONFIRMED", "COMPLETED"] as const;

/**
 * Start times (epoch ms) where `duration` fits inside a working interval without touching anything busy.
 * Starts follow a grid of `step` beginning at each working interval's start (09:00, 09:15, …).
 */
export function freeStarts(working: Interval[], busy: Interval[], duration: number, step: number, earliest: number): number[] {
    const starts: number[] = [];
    for (const shift of working) {
        for (let start = shift.start; start + duration <= shift.end; start += step) {
            if (start < earliest) continue;
            const end = start + duration;
            if (busy.some((b) => b.start < end && b.end > start)) continue;
            starts.push(start);
        }
    }
    return starts;
}

/** Loads everything needed to compute slots for one service between two days (inclusive). */
export async function loadAvailability(
    db: Db,
    dbSessionId: string,
    opts: { serviceId: string; professionalId?: string | null; fromDay: string; toDay: string; timezone: string; excludeAppointmentId?: string },
): Promise<AvailabilityData | null> {
    const service = await db.agendaService.findFirst({
        where: { id: opts.serviceId, sessionId: dbSessionId, active: true },
        select: { id: true, name: true, durationMinutes: true, priceCents: true },
    });
    if (!service) return null;

    const rangeStart = dayBounds(opts.fromDay, opts.timezone).start;
    const rangeEnd = dayBounds(opts.toDay, opts.timezone).end;

    const professionals = await db.agendaProfessional.findMany({
        where: {
            sessionId: dbSessionId,
            active: true,
            services: { some: { serviceId: service.id } },
            ...(opts.professionalId ? { id: opts.professionalId } : {}),
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, hours: { select: { weekday: true, startMinute: true, endMinute: true } } },
    });
    const ids = professionals.map((p) => p.id);

    const [appointments, blocks] = await Promise.all([
        db.agendaAppointment.findMany({
            where: {
                professionalId: { in: ids },
                status: { in: [...ACTIVE_STATUSES] },
                startsAt: { lt: rangeEnd },
                endsAt: { gt: rangeStart },
                ...(opts.excludeAppointmentId ? { id: { not: opts.excludeAppointmentId } } : {}),
            },
            select: { professionalId: true, startsAt: true, endsAt: true },
        }),
        db.agendaBlock.findMany({
            where: {
                sessionId: dbSessionId,
                OR: [{ professionalId: null }, { professionalId: { in: ids } }],
                startsAt: { lt: rangeEnd },
                endsAt: { gt: rangeStart },
            },
            select: { professionalId: true, startsAt: true, endsAt: true },
        }),
    ]);

    const interval = (row: { startsAt: Date; endsAt: Date }): Interval => ({ start: row.startsAt.getTime(), end: row.endsAt.getTime() });

    return {
        service,
        closed: blocks.filter((b) => !b.professionalId).map(interval),
        professionals: professionals.map((p) => ({
            id: p.id,
            name: p.name,
            hours: p.hours,
            busy: [
                ...appointments.filter((a) => a.professionalId === p.id).map(interval),
                ...blocks.filter((b) => b.professionalId === p.id).map(interval),
            ],
        })),
    };
}

/**
 * Every free slot of one day, per professional, ordered by time.
 * `enforceRules` applies the customer limits (minimum notice, booking horizon); the panel turns it off.
 */
export function slotsForDay(
    data: AvailabilityData,
    day: string,
    rules: AgendaRules,
    { now = new Date(), enforceRules = true }: { now?: Date; enforceRules?: boolean } = {},
): Slot[] {
    const today = todayIn(rules.timezone, now);
    if (enforceRules && (day < today || day > addDays(today, rules.maxAdvanceDays))) return [];

    const weekday = weekdayOf(day);
    const duration = data.service.durationMinutes * 60_000;
    const step = rules.slotStep * 60_000;
    const earliest = enforceRules ? now.getTime() + rules.minAdvanceMinutes * 60_000 : 0;

    const slots: Slot[] = [];
    for (const professional of data.professionals) {
        const working = professional.hours
            .filter((h) => h.weekday === weekday && h.endMinute > h.startMinute)
            .sort((a, b) => a.startMinute - b.startMinute)
            .map((h) => ({
                start: dayMinuteToDate(day, h.startMinute, rules.timezone).getTime(),
                end: dayMinuteToDate(day, h.endMinute, rules.timezone).getTime(),
            }));
        const busy = [...professional.busy, ...data.closed];
        for (const start of freeStarts(working, busy, duration, step, earliest)) {
            slots.push({ start: new Date(start), end: new Date(start + duration), professionalId: professional.id, professionalName: professional.name });
        }
    }
    return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * "No preference": one slot per start time. When several professionals are free, the one with the
 * fewest appointments that day gets it, so the work is shared.
 */
export function onePerStart(slots: Slot[], data: AvailabilityData, day: string, timezone: string): Slot[] {
    const { start, end } = dayBounds(day, timezone);
    const load = new Map(
        data.professionals.map((p) => [p.id, p.busy.filter((b) => b.start >= start.getTime() && b.start < end.getTime()).length]),
    );
    const byStart = new Map<number, Slot>();
    for (const slot of slots) {
        const key = slot.start.getTime();
        const current = byStart.get(key);
        if (!current || (load.get(slot.professionalId) ?? 0) < (load.get(current.professionalId) ?? 0)) byStart.set(key, slot);
    }
    return [...byStart.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}

export interface SlotQuery {
    serviceId: string;
    professionalId?: string | null;
    day: string;
    now?: Date;
    excludeAppointmentId?: string;
    enforceRules?: boolean;
    /** Without a professional: keep a single slot per start time (what customers are offered) */
    onePerTime?: boolean;
    db?: Db;
}

/** Free slots of one day. Without a professional, every professional who does the service is considered. */
export async function findSlots(dbSessionId: string, rules: AgendaRules, query: SlotQuery): Promise<Slot[]> {
    const data = await loadAvailability(query.db ?? prisma, dbSessionId, {
        serviceId: query.serviceId,
        professionalId: query.professionalId,
        fromDay: query.day,
        toDay: query.day,
        timezone: rules.timezone,
        excludeAppointmentId: query.excludeAppointmentId,
    });
    if (!data) return [];
    const slots = slotsForDay(data, query.day, rules, { now: query.now, enforceRules: query.enforceRules });
    return query.onePerTime && !query.professionalId ? onePerStart(slots, data, query.day, rules.timezone) : slots;
}

/** The next days (from `fromDay`, within the booking horizon) that still have at least one free slot. */
export async function findAvailableDays(
    dbSessionId: string,
    rules: AgendaRules,
    query: { serviceId: string; professionalId?: string | null; fromDay?: string; limit: number; now?: Date; excludeAppointmentId?: string },
): Promise<{ day: string; count: number }[]> {
    const now = query.now ?? new Date();
    const today = todayIn(rules.timezone, now);
    const lastDay = addDays(today, rules.maxAdvanceDays);
    const fromDay = query.fromDay && query.fromDay > today ? query.fromDay : today;
    if (fromDay > lastDay) return [];

    const data = await loadAvailability(prisma, dbSessionId, {
        serviceId: query.serviceId,
        professionalId: query.professionalId,
        fromDay,
        toDay: lastDay,
        timezone: rules.timezone,
        excludeAppointmentId: query.excludeAppointmentId,
    });
    if (!data) return [];

    const days: { day: string; count: number }[] = [];
    for (let day = fromDay; day <= lastDay && days.length < query.limit; day = addDays(day, 1)) {
        const slots = slotsForDay(data, day, rules, { now });
        const count = query.professionalId ? slots.length : onePerStart(slots, data, day, rules.timezone).length;
        if (count > 0) days.push({ day, count });
    }
    return days;
}
