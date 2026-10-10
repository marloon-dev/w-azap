import type { AgendaAppointment, AgendaProfessional, AgendaService, AppointmentSource, AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { ACTIVE_STATUSES, findSlots, type Db } from "./availability";
import type { AgendaRules } from "./config";
import { getAgendaConfig } from "./config";
import { formatPhoneFromJid, formatPrice, normalizePhone, phoneToJid } from "./format";
import { sendTextBySession } from "./notify";
import { dayOf, whenLabel } from "./time";

export type AppointmentFull = AgendaAppointment & {
    service: Pick<AgendaService, "id" | "name" | "durationMinutes">;
    professional: Pick<AgendaProfessional, "id" | "name" | "phone">;
};

export type BookingErrorCode = "SLOT_TAKEN" | "NOT_FOUND" | "TOO_LATE" | "NOT_ALLOWED" | "LIMIT" | "INVALID";

export class BookingError extends Error {
    constructor(public code: BookingErrorCode, message: string) {
        super(message);
    }
}

const include = {
    service: { select: { id: true, name: true, durationMinutes: true } },
    professional: { select: { id: true, name: true, phone: true } },
} as const;

/** Serializes bookings per professional: the second request waits and then sees the first one's appointment. */
async function lockProfessional(tx: Db, professionalId: string) {
    await tx.$queryRaw`SELECT id FROM \`AgendaProfessional\` WHERE id = ${professionalId} FOR UPDATE`;
}

/** Panel bookings skip working hours and notice rules, but never overlap another appointment. */
async function overlapsAppointment(tx: Db, professionalId: string, start: Date, end: Date, excludeId?: string) {
    const clash = await tx.agendaAppointment.findFirst({
        where: {
            professionalId,
            status: { in: [...ACTIVE_STATUSES] },
            startsAt: { lt: end },
            endsAt: { gt: start },
            ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
    });
    return !!clash;
}

/**
 * Professionals who could take this start time, best first. With a fixed professional it's just that one;
 * otherwise everyone free at that time, the least busy of the day first.
 */
async function candidatesFor(dbSessionId: string, rules: AgendaRules, input: { serviceId: string; professionalId?: string | null; startsAt: Date; now: Date; excludeAppointmentId?: string }) {
    if (input.professionalId) return [input.professionalId];
    const day = dayOf(input.startsAt, rules.timezone);
    const preferred = await findSlots(dbSessionId, rules, { serviceId: input.serviceId, day, now: input.now, onePerTime: true, excludeAppointmentId: input.excludeAppointmentId });
    const all = await findSlots(dbSessionId, rules, { serviceId: input.serviceId, day, now: input.now, excludeAppointmentId: input.excludeAppointmentId });
    const at = input.startsAt.getTime();
    const ids = [...preferred, ...all].filter((s) => s.start.getTime() === at).map((s) => s.professionalId);
    return [...new Set(ids)];
}

/** True when `startsAt` is still a free, bookable slot for this professional (checked inside the lock). */
async function slotStillFree(tx: Db, dbSessionId: string, rules: AgendaRules, input: { serviceId: string; professionalId: string; startsAt: Date; now: Date; enforceRules: boolean; excludeAppointmentId?: string; durationMinutes: number }) {
    if (input.enforceRules) {
        const slots = await findSlots(dbSessionId, rules, {
            serviceId: input.serviceId,
            professionalId: input.professionalId,
            day: dayOf(input.startsAt, rules.timezone),
            now: input.now,
            excludeAppointmentId: input.excludeAppointmentId,
            db: tx,
        });
        return slots.some((s) => s.start.getTime() === input.startsAt.getTime());
    }
    const end = new Date(input.startsAt.getTime() + input.durationMinutes * 60_000);
    return !(await overlapsAppointment(tx, input.professionalId, input.startsAt, end, input.excludeAppointmentId));
}

export interface BookInput {
    dbSessionId: string;
    rules: AgendaRules;
    serviceId: string;
    professionalId?: string | null;
    startsAt: Date;
    customerJid: string;
    customerName?: string | null;
    notes?: string | null;
    source: AppointmentSource;
    /** WhatsApp: true (working hours, notice, horizon). Panel: false (only no overlap). */
    enforceRules: boolean;
    now?: Date;
}

export async function bookAppointment(input: BookInput): Promise<AppointmentFull> {
    const now = input.now ?? new Date();
    const service = await prisma.agendaService.findFirst({ where: { id: input.serviceId, sessionId: input.dbSessionId } });
    if (!service || (input.enforceRules && !service.active)) throw new BookingError("NOT_FOUND", "Serviço não encontrado");
    if (input.professionalId) await assertProfessionalOf(input.dbSessionId, input.professionalId);
    if (input.enforceRules) await assertBelowCustomerLimit(input.dbSessionId, input.rules, input.customerJid, now);

    const candidates = await candidatesFor(input.dbSessionId, input.rules, { ...input, now });
    for (const professionalId of candidates) {
        const created = await prisma.$transaction(async (tx) => {
            await lockProfessional(tx, professionalId);
            const free = await slotStillFree(tx, input.dbSessionId, input.rules, {
                serviceId: service.id,
                professionalId,
                startsAt: input.startsAt,
                now,
                enforceRules: input.enforceRules,
                durationMinutes: service.durationMinutes,
            });
            if (!free) return null;
            return tx.agendaAppointment.create({
                data: {
                    sessionId: input.dbSessionId,
                    professionalId,
                    serviceId: service.id,
                    customerJid: input.customerJid,
                    customerName: input.customerName?.trim().slice(0, 120) || null,
                    notes: input.notes?.trim().slice(0, 2000) || null,
                    startsAt: input.startsAt,
                    endsAt: new Date(input.startsAt.getTime() + service.durationMinutes * 60_000),
                    priceCents: service.priceCents,
                    source: input.source,
                },
                include,
            });
        });
        if (created) {
            logger.info("Agenda", `Appointment ${created.id} booked (${input.source}) for ${created.startsAt.toISOString()}`);
            notifyProfessional(created, "new");
            return created;
        }
    }
    throw new BookingError("SLOT_TAKEN", "Esse horário não está mais disponível");
}

async function assertProfessionalOf(dbSessionId: string, professionalId: string) {
    const professional = await prisma.agendaProfessional.findFirst({ where: { id: professionalId, sessionId: dbSessionId }, select: { id: true } });
    if (!professional) throw new BookingError("NOT_FOUND", "Profissional não encontrado");
}

/** How many upcoming bookings a customer still holds (BOOKED or CONFIRMED). */
export function countActiveForCustomer(dbSessionId: string, customerJid: string, now = new Date()) {
    return prisma.agendaAppointment.count({
        where: { sessionId: dbSessionId, customerJid, status: { in: ["BOOKED", "CONFIRMED"] }, startsAt: { gt: now } },
    });
}

/** Customers can't fill the agenda: past the limit they must cancel one first (the panel has no limit). */
async function assertBelowCustomerLimit(dbSessionId: string, rules: AgendaRules, customerJid: string, now: Date) {
    if (!rules.maxActivePerCustomer) return;
    if ((await countActiveForCustomer(dbSessionId, customerJid, now)) >= rules.maxActivePerCustomer) {
        throw new BookingError("LIMIT", `Você já tem ${rules.maxActivePerCustomer} agendamento(s) ativo(s); cancele ou aguarde um deles antes de marcar outro`);
    }
}

async function loadOwned(dbSessionId: string, appointmentId: string, customerJid?: string) {
    const appointment = await prisma.agendaAppointment.findFirst({
        where: { id: appointmentId, sessionId: dbSessionId, ...(customerJid ? { customerJid } : {}) },
        include,
    });
    if (!appointment) throw new BookingError("NOT_FOUND", "Agendamento não encontrado");
    return appointment;
}

function assertCustomerCanChange(appointment: AgendaAppointment, rules: AgendaRules, now: Date) {
    if (appointment.status !== "BOOKED" && appointment.status !== "CONFIRMED") {
        throw new BookingError("NOT_ALLOWED", "Esse agendamento já foi cancelado ou concluído");
    }
    if (appointment.startsAt.getTime() - now.getTime() < rules.cancelMinHours * 3_600_000) {
        throw new BookingError("TOO_LATE", `Alterações só podem ser feitas com ${rules.cancelMinHours} h de antecedência`);
    }
}

export async function cancelAppointment(input: {
    dbSessionId: string;
    rules: AgendaRules;
    appointmentId: string;
    by: "customer" | "panel";
    customerJid?: string;
    notifyCustomer?: boolean;
    now?: Date;
}): Promise<AppointmentFull> {
    const now = input.now ?? new Date();
    const appointment = await loadOwned(input.dbSessionId, input.appointmentId, input.by === "customer" ? input.customerJid : undefined);
    if (input.by === "customer") assertCustomerCanChange(appointment, input.rules, now);
    else if (appointment.status === "CANCELLED") return appointment;

    const updated = await prisma.agendaAppointment.update({
        where: { id: appointment.id },
        data: { status: "CANCELLED", cancelledAt: now },
        include,
    });
    logger.info("Agenda", `Appointment ${updated.id} cancelled by ${input.by}`);
    notifyProfessional(updated, "cancelled");
    if (input.by === "panel" && input.notifyCustomer) {
        sendTextBySession(
            input.dbSessionId,
            updated.customerJid,
            `Olá${updated.customerName ? `, ${updated.customerName}` : ""}! Seu agendamento de *${updated.service.name}* em *${whenLabel(updated.startsAt, input.rules.timezone)}* foi cancelado. Se quiser marcar outro horário, é só mandar uma mensagem.`,
        );
    }
    return updated;
}

export async function rescheduleAppointment(input: {
    dbSessionId: string;
    rules: AgendaRules;
    appointmentId: string;
    startsAt: Date;
    professionalId?: string | null;
    by: "customer" | "panel";
    customerJid?: string;
    notifyCustomer?: boolean;
    now?: Date;
}): Promise<AppointmentFull> {
    const now = input.now ?? new Date();
    const appointment = await loadOwned(input.dbSessionId, input.appointmentId, input.by === "customer" ? input.customerJid : undefined);
    if (input.by === "customer") assertCustomerCanChange(appointment, input.rules, now);
    else if (appointment.status === "CANCELLED") throw new BookingError("NOT_ALLOWED", "Esse agendamento foi cancelado");

    const enforceRules = input.by === "customer";
    if (input.professionalId) await assertProfessionalOf(input.dbSessionId, input.professionalId);
    const professionalId = input.professionalId || appointment.professionalId;
    const candidates = input.professionalId || input.by === "panel"
        ? [professionalId]
        : await candidatesFor(input.dbSessionId, input.rules, { serviceId: appointment.serviceId, professionalId, startsAt: input.startsAt, now, excludeAppointmentId: appointment.id });

    for (const candidate of candidates) {
        const updated = await prisma.$transaction(async (tx) => {
            await lockProfessional(tx, candidate);
            const free = await slotStillFree(tx, input.dbSessionId, input.rules, {
                serviceId: appointment.serviceId,
                professionalId: candidate,
                startsAt: input.startsAt,
                now,
                enforceRules,
                excludeAppointmentId: appointment.id,
                durationMinutes: appointment.service.durationMinutes,
            });
            if (!free) return null;
            return tx.agendaAppointment.update({
                where: { id: appointment.id },
                data: {
                    professionalId: candidate,
                    startsAt: input.startsAt,
                    endsAt: new Date(input.startsAt.getTime() + appointment.service.durationMinutes * 60_000),
                    status: "BOOKED",
                    reminderSentAt: null,
                },
                include,
            });
        });
        if (updated) {
            logger.info("Agenda", `Appointment ${updated.id} rescheduled by ${input.by} to ${updated.startsAt.toISOString()}`);
            notifyProfessional(updated, "rescheduled", appointment);
            if (input.by === "panel" && input.notifyCustomer) {
                sendTextBySession(
                    input.dbSessionId,
                    updated.customerJid,
                    `Olá${updated.customerName ? `, ${updated.customerName}` : ""}! Seu agendamento de *${updated.service.name}* foi remarcado para *${whenLabel(updated.startsAt, input.rules.timezone)}* com ${updated.professional.name}.`,
                );
            }
            return updated;
        }
    }
    throw new BookingError("SLOT_TAKEN", "Esse horário não está mais disponível");
}

/** Panel-only status changes (confirm, mark as done or as no-show, reopen). */
export async function setAppointmentStatus(dbSessionId: string, appointmentId: string, status: AppointmentStatus) {
    const appointment = await loadOwned(dbSessionId, appointmentId);
    return prisma.agendaAppointment.update({
        where: { id: appointment.id },
        data: { status, ...(status === "CANCELLED" ? { cancelledAt: new Date() } : { cancelledAt: null }) },
        include,
    });
}

/** Customer's upcoming appointments (still active), soonest first. */
export async function upcomingForCustomer(dbSessionId: string, customerJid: string, now = new Date()) {
    return prisma.agendaAppointment.findMany({
        where: { sessionId: dbSessionId, customerJid, status: { in: ["BOOKED", "CONFIRMED"] }, startsAt: { gt: now } },
        orderBy: { startsAt: "asc" },
        take: 10,
        include,
    });
}

/** "Corte com Ana — sex, 17/10 às 14:30 (R$ 45,00)" */
export function describeAppointment(appointment: AppointmentFull, timezone: string, { price = false } = {}) {
    const value = price ? formatPrice(appointment.priceCents) : null;
    return `${appointment.service.name} com ${appointment.professional.name} — ${whenLabel(appointment.startsAt, timezone)}${value ? ` (${value})` : ""}`;
}

/** Tells the professional on WhatsApp (when enabled and a number is set). Never throws. */
function notifyProfessional(appointment: AppointmentFull, kind: "new" | "cancelled" | "rescheduled", before?: AppointmentFull) {
    (async () => {
        const config = await getAgendaConfig(appointment.sessionId);
        if (!config?.notifyProfessional) return;
        const tz = config.timezone;
        const targets = new Set([appointment.professional.phone]);
        if (kind === "rescheduled" && before && before.professional.id !== appointment.professional.id) targets.add(before.professional.phone);

        const customer = `${appointment.customerName || "Cliente"} (${formatPhoneFromJid(appointment.customerJid)})`;
        const title = { new: "📅 *Novo agendamento*", cancelled: "❌ *Agendamento cancelado*", rescheduled: "🔁 *Agendamento remarcado*" }[kind];
        const lines = [title, `Cliente: ${customer}`, `Serviço: ${appointment.service.name}`, `Profissional: ${appointment.professional.name}`];
        if (kind === "rescheduled" && before) lines.push(`Antes: ${whenLabel(before.startsAt, tz)}`, `Agora: ${whenLabel(appointment.startsAt, tz)}`);
        else lines.push(`Quando: ${whenLabel(appointment.startsAt, tz)}`);
        if (appointment.notes) lines.push(`Obs.: ${appointment.notes}`);

        for (const phone of targets) {
            const digits = normalizePhone(phone);
            if (digits) await sendTextBySession(appointment.sessionId, phoneToJid(digits), lines.join("\n"));
        }
    })().catch((error) => logger.error("Agenda", "Professional notification failed", error));
}
