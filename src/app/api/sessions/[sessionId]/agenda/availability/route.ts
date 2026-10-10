import { NextRequest } from "next/server";
import { findSlots } from "@/lib/agenda/availability";
import { timeOf } from "@/lib/agenda/time";
import { authorizeAgenda, reject, ok, rulesFor, serverError } from "../shared";
import { daySchema } from "../schemas";

/**
 * Free start times of a service on a day. `mode=customer` applies what customers see on WhatsApp
 * (notice, horizon); the default `panel` lists every free time inside working hours.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    try {
        const auth = await authorizeAgenda(request, sessionId);
        if (auth.error) return auth.error;
        const search = request.nextUrl.searchParams;
        const serviceId = search.get("serviceId");
        const day = search.get("day") || "";
        if (!serviceId) return reject(400, "Informe o serviço");
        if (!daySchema.safeParse(day).success) return reject(400, "Data inválida (use AAAA-MM-DD)");

        const rules = await rulesFor(auth.dbSessionId);
        const customer = search.get("mode") === "customer";
        const slots = await findSlots(auth.dbSessionId, rules, {
            serviceId,
            professionalId: search.get("professionalId") || null,
            day,
            enforceRules: customer,
            onePerTime: customer,
            excludeAppointmentId: search.get("excludeAppointmentId") || undefined,
        });
        return ok("Horários livres", {
            timezone: rules.timezone,
            slots: slots.map((s) => ({ start: s.start.toISOString(), time: timeOf(s.start, rules.timezone), professionalId: s.professionalId, professionalName: s.professionalName })),
        });
    } catch (error) {
        return serverError("Availability", error);
    }
}
