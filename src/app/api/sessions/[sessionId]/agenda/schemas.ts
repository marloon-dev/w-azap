import { z } from "zod";
import { isValidDay } from "@/lib/agenda/time";
import { TIME_PATTERN, toMinute } from "./shared";

export const serviceSchema = z.object({
    name: z.string().trim().min(1, "Informe o nome do serviço").max(120),
    description: z.string().trim().max(1000).nullable().optional(),
    durationMinutes: z.number().int().min(5, "Duração mínima de 5 minutos").max(720),
    priceCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
    active: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
    professionalIds: z.array(z.string()).max(200).optional(),
});

const hourSchema = z
    .object({
        weekday: z.number().int().min(0).max(6),
        start: z.string().regex(TIME_PATTERN, "Horário inválido"),
        end: z.string().regex(TIME_PATTERN, "Horário inválido"),
    })
    .refine((h) => toMinute(h.end) > toMinute(h.start), "O fim do expediente precisa ser depois do início");

export const professionalSchema = z
    .object({
        name: z.string().trim().min(1, "Informe o nome").max(120),
        phone: z.string().trim().max(30).nullable().optional(),
        active: z.boolean().default(true),
        sortOrder: z.number().int().min(0).max(10_000).default(0),
        serviceIds: z.array(z.string()).max(200).default([]),
        hours: z.array(hourSchema).max(70).default([]),
    })
    .refine((p) => {
        // Intervals of the same weekday must not overlap
        for (let day = 0; day < 7; day++) {
            const ranges = p.hours.filter((h) => h.weekday === day).map((h) => [toMinute(h.start), toMinute(h.end)]).sort((a, b) => a[0] - b[0]);
            for (let i = 1; i < ranges.length; i++) if (ranges[i][0] < ranges[i - 1][1]) return false;
        }
        return true;
    }, "Há intervalos sobrepostos no mesmo dia");

export const blockSchema = z
    .object({
        professionalId: z.string().nullable().optional(),
        startsAt: z.iso.datetime({ offset: true }),
        endsAt: z.iso.datetime({ offset: true }),
        reason: z.string().trim().max(200).nullable().optional(),
    })
    .refine((b) => new Date(b.endsAt) > new Date(b.startsAt), "O fim precisa ser depois do início");

export const daySchema = z.string().refine(isValidDay, "Data inválida (use AAAA-MM-DD)");

export const createAppointmentSchema = z.object({
    serviceId: z.string().min(1, "Escolha o serviço"),
    professionalId: z.string().min(1, "Escolha o profissional"),
    startsAt: z.iso.datetime({ offset: true }),
    customerPhone: z.string().trim().min(8, "Informe o WhatsApp do cliente").max(30),
    customerName: z.string().trim().max(120).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
});

export const updateAppointmentSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("status"), status: z.enum(["BOOKED", "CONFIRMED", "COMPLETED", "NO_SHOW"]) }),
    z.object({ action: z.literal("cancel"), notifyCustomer: z.boolean().default(false) }),
    z.object({
        action: z.literal("reschedule"),
        startsAt: z.iso.datetime({ offset: true }),
        professionalId: z.string().optional(),
        notifyCustomer: z.boolean().default(false),
    }),
    z.object({ action: z.literal("notes"), notes: z.string().trim().max(2000).nullable() }),
]);
