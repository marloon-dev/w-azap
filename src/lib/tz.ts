/**
 * Timezone helpers on top of the built-in Intl API (server and browser), so no timezone
 * database has to ship with the app. Days travel as "YYYY-MM-DD", times as "HH:mm".
 *
 * Wall-clock → instant follows the usual convention: a time skipped by a DST jump moves
 * forward, and an ambiguous time (clocks set back) resolves to its first occurrence.
 */

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(tz: string) {
    let formatter = formatters.get(tz);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            hourCycle: "h23",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
        formatters.set(tz, formatter);
    }
    return formatter;
}

const pad = (value: number, size = 2) => String(value).padStart(size, "0");

export function isValidTimezone(tz: string): boolean {
    if (!tz) return false;
    try {
        formatterFor(tz);
        return true;
    } catch {
        return false;
    }
}

/** Wall-clock fields of an instant in a timezone */
export function zonedParts(date: Date, tz: string) {
    const parts: Record<string, number> = {};
    for (const { type, value } of formatterFor(tz).formatToParts(date)) {
        if (type !== "literal") parts[type] = Number(value);
    }
    return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute, second: parts.second };
}

/** Offset of the timezone at an instant, in minutes east of UTC (São Paulo → -180) */
export function offsetMinutes(date: Date, tz: string): number {
    const p = zonedParts(date, tz);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** "YYYY-MM-DD" of an instant in the timezone */
export function formatDay(date: Date, tz: string): string {
    const p = zonedParts(date, tz);
    return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** "HH:mm" (or "HH:mm:ss") of an instant in the timezone */
export function formatTime(date: Date, tz: string, withSeconds = false): string {
    const p = zonedParts(date, tz);
    return withSeconds ? `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}` : `${pad(p.hour)}:${pad(p.minute)}`;
}

/** "YYYY-MM-DDTHH:mm" (or with ":ss") — the value of an <input type="datetime-local"> */
export function formatLocalDateTime(date: Date, tz: string, withSeconds = false): string {
    return `${formatDay(date, tz)}T${formatTime(date, tz, withSeconds)}`;
}

/** ISO 8601 with the timezone's offset, e.g. "2026-10-17T14:30:00-03:00" ("Z" when the offset is zero) */
export function formatOffsetIso(date: Date, tz: string): string {
    const offset = offsetMinutes(date, tz);
    if (offset === 0) return `${formatLocalDateTime(date, tz, true)}Z`;
    const sign = offset < 0 ? "-" : "+";
    const abs = Math.abs(offset);
    return `${formatLocalDateTime(date, tz, true)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** The instant a wall-clock day + "HH:mm[:ss]" happens in the timezone */
export function zonedTimeToDate(day: string, time: string, tz: string): Date {
    const d = DAY_RE.exec(day);
    const t = TIME_RE.exec(time);
    if (!d || !t || !isValidDay(day) || Number(t[1]) > 23 || Number(t[2]) > 59 || Number(t[3] ?? 0) > 59) return new Date(NaN);
    const wall = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]), Number(t[3] ?? 0));

    // A DST change around this day gives two possible offsets: try the ones in effect a day before and after
    const DAY_MS = 86_400_000;
    const offsets = new Set([wall - DAY_MS, wall, wall + DAY_MS].map((at) => offsetMinutes(new Date(at), tz)));
    const candidates = [...offsets].map((offset) => wall - offset * 60000);
    const readsBack = (instant: number) => {
        const p = zonedParts(new Date(instant), tz);
        return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) === wall;
    };
    const matches = candidates.filter(readsBack);
    // Ambiguous (clocks set back): the first occurrence
    if (matches.length > 0) return new Date(Math.min(...matches));
    // Skipped by a DST jump: the same wall time after the jump
    return new Date(Math.max(...candidates));
}

/** Parses "YYYY-MM-DDTHH:mm[:ss]" (datetime-local) as wall-clock time in the timezone */
export function localDateTimeToDate(value: string, tz: string): Date {
    const [day, time = "00:00"] = value.split("T");
    return zonedTimeToDate(day, time.slice(0, 8), tz);
}

/**
 * A date-time sent by a client: with an offset ("…Z", "…-03:00") it is an exact instant;
 * without one ("2026-10-17T14:30") it is wall-clock time in the timezone. Invalid input → Invalid Date.
 */
export function parseDateTimeInZone(value: string, tz: string): Date {
    const text = String(value ?? "").trim();
    if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) return new Date(text);
    if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(text)) return new Date(NaN);
    return localDateTimeToDate(text.replace(" ", "T").replace(/\.\d+$/, ""), tz);
}

/** Strict "YYYY-MM-DD" that names a real calendar day */
export function isValidDay(day: string): boolean {
    const m = DAY_RE.exec(day);
    if (!m) return false;
    const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return date.getUTCFullYear() === Number(m[1]) && date.getUTCMonth() === Number(m[2]) - 1 && date.getUTCDate() === Number(m[3]);
}

function dayToUtc(day: string): Date {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

function utcToDay(date: Date): string {
    return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDaysToDay(day: string, amount: number): string {
    const date = dayToUtc(day);
    date.setUTCDate(date.getUTCDate() + amount);
    return utcToDay(date);
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOfDay(day: string): number {
    return dayToUtc(day).getUTCDay();
}

/** Monday of the week that contains the day */
export function isoWeekStart(day: string): string {
    return addDaysToDay(day, -((weekdayOfDay(day) + 6) % 7));
}
