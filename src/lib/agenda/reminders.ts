import cron from "node-cron";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { saveConversation } from "./assistant/conversation";
import { reminderText } from "./assistant/menu";
import { socketForSession, sendText } from "./notify";

let started = false;

/**
 * Sends "you have an appointment" reminders `reminderHours` before each booking and leaves the chat
 * waiting for "1" (confirm) / "2" (cancel) / "3" (reschedule). Appointments booked inside that window
 * are skipped: the customer just made them.
 */
export async function sendDueReminders(now = new Date()) {
    const configs = await prisma.agendaConfig.findMany({
        where: { enabled: true, reminderEnabled: true, reminderHours: { gt: 0 } },
        select: { sessionId: true, reminderHours: true, timezone: true },
    });

    for (const config of configs) {
        const windowMs = config.reminderHours * 3_600_000;
        const due = await prisma.agendaAppointment.findMany({
            where: {
                sessionId: config.sessionId,
                status: "BOOKED",
                reminderSentAt: null,
                startsAt: { gt: now, lte: new Date(now.getTime() + windowMs) },
            },
            include: { service: { select: { id: true, name: true, durationMinutes: true } }, professional: { select: { id: true, name: true, phone: true } } },
            orderBy: { startsAt: "asc" },
            take: 50,
        });
        if (due.length === 0) continue;

        const sock = await socketForSession(config.sessionId);
        for (const appointment of due) {
            const bookedInsideWindow = appointment.startsAt.getTime() - appointment.createdAt.getTime() < windowMs;
            const simulated = appointment.customerJid.endsWith("@agenda.local");
            if (bookedInsideWindow || simulated) {
                await prisma.agendaAppointment.update({ where: { id: appointment.id }, data: { reminderSentAt: now } });
                continue;
            }
            if (!sock) break; // Offline: try again next minute

            // Claim first so a slow send can't make the next run send it twice
            const claimed = await prisma.agendaAppointment.updateMany({ where: { id: appointment.id, reminderSentAt: null }, data: { reminderSentAt: now } });
            if (claimed.count === 0) continue;

            const sent = await sendText(sock, appointment.customerJid, reminderText(appointment, config.timezone, now));
            if (sent) {
                await saveConversation(config.sessionId, appointment.customerJid, { state: { step: "reminder", appointmentId: appointment.id }, pausedUntil: null }, now);
                logger.info("Agenda", `Reminder sent for appointment ${appointment.id}`);
            } else {
                await prisma.agendaAppointment.update({ where: { id: appointment.id }, data: { reminderSentAt: null } });
            }
        }
    }
}

export function startAgendaReminders() {
    if (started) return;
    started = true;
    cron.schedule("* * * * *", () => {
        sendDueReminders().catch((error) => logger.error("Agenda", "Reminder job failed", error));
    });
    logger.info("Agenda", "Reminder job scheduled");
}
