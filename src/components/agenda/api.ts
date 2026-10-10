"use client";

import moment from "moment-timezone";

export interface ApiResult<T> {
    ok: boolean;
    status: number;
    data: T | null;
    message: string | null;
    code: string | null;
}

/** fetch() for /api/sessions/{id}/agenda/* that never throws; the message comes from the server (pt-BR). */
export async function agendaRequest<T = unknown>(sessionId: string, path: string, init?: { method?: string; body?: unknown }): Promise<ApiResult<T>> {
    try {
        const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/agenda/${path}`, {
            method: init?.method ?? "GET",
            headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
            body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
        });
        const body = await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, data: (body?.data ?? null) as T | null, message: body?.message ?? null, code: body?.code ?? null };
    } catch {
        return { ok: false, status: 0, data: null, message: null, code: null };
    }
}

export const DAY = "YYYY-MM-DD";

export const todayIn = (tz: string) => moment().tz(tz).format(DAY);
export const shiftDay = (day: string, amount: number) => moment(day, DAY).add(amount, "days").format(DAY);
export const timeIn = (iso: string | Date, tz: string) => moment(iso).tz(tz).format("HH:mm");
export const dayIn = (iso: string | Date, tz: string) => moment(iso).tz(tz).format(DAY);

/** Wall-clock day + "HH:MM" in the business timezone → ISO instant with offset */
export const zonedIso = (day: string, time: string, tz: string) => moment.tz(`${day} ${time}`, `${DAY} HH:mm`, tz).format();

/** Monday of the week that contains `day` */
export const weekStart = (day: string) => moment(day, DAY).isoWeekday(1).format(DAY);

export function formatDayLong(day: string, locale: string) {
    return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

export function formatDayShort(day: string, locale: string) {
    return new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

/** Weekday names starting on Sunday (index = weekday number) */
export function weekdayNames(locale: string, style: "long" | "short" = "long") {
    // 2024-01-07 was a Sunday
    return Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: style, timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 7 + i))));
}

export function formatMoney(cents: number | null | undefined, locale: string) {
    if (cents === null || cents === undefined) return null;
    return (cents / 100).toLocaleString(locale, { style: "currency", currency: "BRL" });
}

/** "45", "45,90", "R$ 1.234,50" → cents; null for empty; NaN for garbage */
export function parseMoney(input: string): number | null {
    const text = input.replace(/[^\d,.-]/g, "").trim();
    if (!text) return null;
    const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
    const value = Number(normalized);
    return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : Number.NaN;
}

/** "5511987654321" → "+55 11 98765-4321" (Brazilian numbers), otherwise "+<digits>" */
export function formatPhone(digits: string) {
    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
        const rest = digits.slice(4);
        return `+55 ${digits.slice(2, 4)} ${rest.slice(0, -4)}-${rest.slice(-4)}`;
    }
    return `+${digits}`;
}

export function formatDuration(minutes: number) {
    if (minutes < 60) return `${minutes} min`;
    const rest = minutes % 60;
    return rest ? `${Math.floor(minutes / 60)}h${String(rest).padStart(2, "0")}` : `${minutes / 60}h`;
}
