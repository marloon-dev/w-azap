import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelAppointment, rescheduleAppointment, setAppointmentStatus } from "@/lib/agenda/booking";
import { authorizeAgenda, reject, ok, parseBody, rulesFor, serverError } from "../../shared";
import { updateAppointmentSchema } from "../../schemas";

/** Team actions on one appointment: change status, cancel, reschedule or edit the notes. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ sessionId: string; id: string }> }) {
    const { sessionId, id } = await params;
    try {
        const auth = await authorizeAgenda(request, sessionId);
        if (auth.error) return auth.error;
        const body = await parseBody(request, updateAppointmentSchema);
        if (body.error) return body.error;
        const input = body.data;
        const rules = await rulesFor(auth.dbSessionId);

        switch (input.action) {
            case "status":
                return ok("Status atualizado", await setAppointmentStatus(auth.dbSessionId, id, input.status));
            case "cancel":
                return ok(
                    "Agendamento cancelado",
                    await cancelAppointment({ dbSessionId: auth.dbSessionId, rules, appointmentId: id, by: "panel", notifyCustomer: input.notifyCustomer }),
                );
            case "reschedule":
                return ok(
                    "Agendamento remarcado",
                    await rescheduleAppointment({
                        dbSessionId: auth.dbSessionId,
                        rules,
                        appointmentId: id,
                        startsAt: new Date(input.startsAt),
                        professionalId: input.professionalId,
                        by: "panel",
                        notifyCustomer: input.notifyCustomer,
                    }),
                );
            case "notes": {
                const result = await prisma.agendaAppointment.updateMany({ where: { id, sessionId: auth.dbSessionId }, data: { notes: input.notes || null } });
                if (result.count === 0) return reject(404, "Agendamento não encontrado");
                return ok("Observações salvas");
            }
        }
    } catch (error) {
        return serverError("Update appointment", error);
    }
}
