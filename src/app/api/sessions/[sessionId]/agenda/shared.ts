import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { canAccessSession, getAuthenticatedUser, isSessionOwner } from "@/lib/api-auth";
import { BookingError } from "@/lib/agenda/booking";
import type { AgendaRules } from "@/lib/agenda/config";

type Fail = { error: NextResponse };
type Ok<T> = { error?: undefined } & T;

export const fail = (status: number, message: string, extra: Record<string, unknown> = {}): Fail => ({
    error: NextResponse.json({ status: false, message, error: message, ...extra }, { status }),
});

/** Error response for a route handler. */
export const reject = (status: number, message: string, extra: Record<string, unknown> = {}) => fail(status, message, extra).error;

export const ok = (message: string, data?: unknown, status = 200) => NextResponse.json({ status: true, message, data }, { status });

/**
 * Anyone with access to the session can run the agenda (receptionists, staff).
 * `ownerOnly` guards what can leak or cost money: the AI provider and its key.
 */
export async function authorizeAgenda(
    request: NextRequest,
    sessionId: string,
    options: { ownerOnly?: boolean; allowApiKey?: boolean } = {},
): Promise<Fail | Ok<{ dbSessionId: string; user: { id: string; name: string | null; role: string } }>> {
    const user = await getAuthenticatedUser(request, { allowApiKey: options.allowApiKey ?? true });
    if (!user) return fail(401, "Não autorizado");
    if (user.authMethod === "session" && !sameOrigin(request)) return fail(403, "Origem da requisição não permitida");
    const allowed = options.ownerOnly ? await isSessionOwner(user.id, user.role, sessionId) : await canAccessSession(user.id, user.role, sessionId);
    if (!allowed) return fail(403, options.ownerOnly ? "Apenas o dono da sessão pode alterar esta configuração" : "Sem acesso a esta sessão");
    const session = await prisma.session.findUnique({ where: { sessionId }, select: { id: true } });
    if (!session) return fail(404, "Sessão não encontrada");
    return { dbSessionId: session.id, user };
}

/**
 * Browser requests that change data must come from this site (defense in depth on top of SameSite cookies).
 * Requests without an Origin header (same-origin GETs, server-to-server) pass.
 */
function sameOrigin(request: NextRequest): boolean {
    if (request.method === "GET" || request.method === "HEAD") return true;
    const origin = request.headers.get("origin");
    if (!origin) return true;
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    try {
        return !!host && new URL(origin).host === host;
    } catch {
        return false;
    }
}

/** Origin (scheme + host + port) of a URL, or null */
export function originOf(url: string | null | undefined): string | null {
    try {
        return url ? new URL(url).origin : null;
    } catch {
        return null;
    }
}

export async function parseBody<S extends z.ZodType>(request: NextRequest, schema: S): Promise<Fail | Ok<{ data: z.infer<S> }>> {
    let raw: unknown;
    try {
        raw = await request.json();
    } catch {
        return fail(400, "Corpo da requisição inválido");
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return fail(400, issue?.message || "Dados inválidos", { field: issue?.path.join(".") });
    }
    return { data: parsed.data };
}

const DEFAULT_RULES: AgendaRules = { timezone: "America/Sao_Paulo", slotStep: 15, minAdvanceMinutes: 60, maxAdvanceDays: 30, cancelMinHours: 2, maxActivePerCustomer: 3 };

/** Booking rules of a session, with the defaults when the agenda was never configured. */
export async function rulesFor(dbSessionId: string): Promise<AgendaRules> {
    const config = await prisma.agendaConfig.findUnique({
        where: { sessionId: dbSessionId },
        select: { timezone: true, slotStep: true, minAdvanceMinutes: true, maxAdvanceDays: true, cancelMinHours: true, maxActivePerCustomer: true },
    });
    return config ?? DEFAULT_RULES;
}

const BOOKING_STATUS: Record<string, number> = { SLOT_TAKEN: 409, NOT_FOUND: 404, TOO_LATE: 409, NOT_ALLOWED: 409, LIMIT: 409, INVALID: 400 };

/** Uniform answer for unexpected errors; booking errors keep their message and code. */
export function serverError(scope: string, error: unknown) {
    if (error instanceof BookingError) {
        return NextResponse.json({ status: false, message: error.message, error: error.message, code: error.code }, { status: BOOKING_STATUS[error.code] ?? 400 });
    }
    logger.error("Agenda", `${scope} error`, error);
    return NextResponse.json({ status: false, message: "Erro interno do servidor", error: "Erro interno do servidor" }, { status: 500 });
}

/** "HH:MM" text to minutes after midnight */
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;
export const toMinute = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
