import { addDaysToDay, formatDay, formatTime, isValidDay as isRealDay, isValidTimezone as isKnownTimezone, weekdayOfDay, zonedTimeToDate } from "@/lib/tz";

/* Calendar days travel as "YYYY-MM-DD" strings, always read in the business timezone. */

const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const WEEKDAYS_LONG = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export function isValidTimezone(tz: string): boolean {
    return isKnownTimezone(tz);
}

export function isValidDay(day: string): boolean {
    return isRealDay(day);
}

export function todayIn(tz: string, now: Date = new Date()): string {
    return formatDay(now, tz);
}

export function addDays(day: string, amount: number): string {
    return addDaysToDay(day, amount);
}

/** 0 = Sunday … 6 = Saturday, like Date#getDay and AgendaWorkingHour.weekday */
export function weekdayOf(day: string): number {
    return weekdayOfDay(day);
}

/** The instant a wall-clock time happens on a day in the timezone (1440 = midnight of the next day). */
export function dayMinuteToDate(day: string, minute: number, tz: string): Date {
    if (minute >= 1440) return dayBounds(day, tz).end;
    return zonedTimeToDate(day, minuteToTime(minute), tz);
}

export function dayBounds(day: string, tz: string): { start: Date; end: Date } {
    return { start: zonedTimeToDate(day, "00:00", tz), end: zonedTimeToDate(addDaysToDay(day, 1), "00:00", tz) };
}

export function dayOf(date: Date, tz: string): string {
    return formatDay(date, tz);
}

export function timeOf(date: Date, tz: string): string {
    return formatTime(date, tz);
}

/** "14:30" → 870; null when invalid */
export function parseTimeOfDay(value: string): number | null {
    const match = /^(\d{1,2})[:h](\d{2})$/.exec(value.trim());
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 24 || minutes > 59 || (hours === 24 && minutes > 0)) return null;
    return hours * 60 + minutes;
}

export function minuteToTime(minute: number): string {
    return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

/** "sex, 17/10" */
export function shortDayLabel(day: string): string {
    return `${WEEKDAYS_SHORT[weekdayOfDay(day)]}, ${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

/** "Hoje (sex, 17/10)", "Amanhã (sáb, 18/10)" or "seg, 20/10" */
export function relativeDayLabel(day: string, today: string): string {
    if (day === today) return `Hoje (${shortDayLabel(day)})`;
    if (day === addDays(today, 1)) return `Amanhã (${shortDayLabel(day)})`;
    return shortDayLabel(day);
}

export function weekdayName(day: string): string {
    return WEEKDAYS_LONG[weekdayOf(day)];
}

/** "sex, 17/10 às 14:30" */
export function whenLabel(date: Date, tz: string): string {
    return `${shortDayLabel(dayOf(date, tz))} às ${timeOf(date, tz)}`;
}

/**
 * Reads a day typed by a customer: "17/10", "17/10/2026", "17-10" or "2026-10-17".
 * Day/month without a year means the next occurrence from today.
 */
export function parseCustomerDay(input: string, today: string): string | null {
    const text = input.trim();
    if (isValidDay(text)) return text;
    const match = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(text);
    if (!match) return null;
    const dayNum = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    if (match[3]) {
        const year = match[3].length === 2 ? `20${match[3]}` : match[3];
        const day = `${year}-${month}-${dayNum}`;
        return isValidDay(day) ? day : null;
    }
    const year = Number(today.slice(0, 4));
    for (const candidateYear of [year, year + 1]) {
        const day = `${candidateYear}-${month}-${dayNum}`;
        if (isValidDay(day) && day >= today) return day;
    }
    return null;
}
