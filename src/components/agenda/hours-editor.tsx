"use client";

import { Copy, Plus, X } from "lucide-react";
import { useTranslation } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { weekdayNames } from "./api";
import type { WorkingHour } from "./types";

/** Monday first, the way people read a work week */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const DEFAULT_HOURS: WorkingHour[] = [
    ...[1, 2, 3, 4, 5].flatMap((weekday) => [
        { weekday, start: "09:00", end: "12:00" },
        { weekday, start: "13:00", end: "18:00" },
    ]),
    { weekday: 6, start: "09:00", end: "13:00" },
];

/** Weekly working hours: a switch per day and one or more intervals (to leave room for lunch). */
export function HoursEditor({ value, onChange }: { value: WorkingHour[]; onChange: (hours: WorkingHour[]) => void }) {
    const { t, locale } = useTranslation();
    const names = weekdayNames(locale);

    const ofDay = (weekday: number) => value.filter((h) => h.weekday === weekday);
    const replaceDay = (weekday: number, intervals: Omit<WorkingHour, "weekday">[]) =>
        onChange([...value.filter((h) => h.weekday !== weekday), ...intervals.map((i) => ({ ...i, weekday }))].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start)));

    const toggleDay = (weekday: number, open: boolean) => replaceDay(weekday, open ? [{ start: "09:00", end: "18:00" }] : []);

    const addInterval = (weekday: number) => {
        const intervals = ofDay(weekday);
        const last = intervals[intervals.length - 1];
        const start = last ? last.end : "09:00";
        const [h, m] = start.split(":").map(Number);
        const end = `${String(Math.min(h + 2, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        replaceDay(weekday, [...intervals, { start, end }]);
    };

    const copyMonday = () => {
        const monday = ofDay(1);
        onChange([...value.filter((h) => h.weekday === 0 || h.weekday === 1 || h.weekday === 6), ...[2, 3, 4, 5].flatMap((weekday) => monday.map((h) => ({ ...h, weekday })))].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start)));
    };

    return (
        <div className="space-y-2">
            <div className="divide-y divide-border rounded-md border border-border">
                {DAY_ORDER.map((weekday) => {
                    const intervals = ofDay(weekday);
                    const open = intervals.length > 0;
                    return (
                        <div key={weekday} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
                            <label className="flex w-40 shrink-0 items-center gap-2 pt-1.5 text-sm font-medium capitalize">
                                <Switch checked={open} onCheckedChange={(v) => toggleDay(weekday, v)} />
                                {names[weekday]}
                            </label>
                            <div className="flex flex-1 flex-col gap-2">
                                {!open && <p className="pt-1.5 text-sm text-muted-foreground">{t("agenda.professionals.dayOff")}</p>}
                                {intervals.map((interval, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <Input
                                            type="time"
                                            className="w-28"
                                            value={interval.start}
                                            onChange={(e) => replaceDay(weekday, intervals.map((it, i) => (i === index ? { ...it, start: e.target.value } : it)))}
                                            aria-label={`${names[weekday]} ${index + 1}`}
                                        />
                                        <span className="text-muted-foreground">–</span>
                                        <Input
                                            type="time"
                                            className="w-28"
                                            value={interval.end}
                                            onChange={(e) => replaceDay(weekday, intervals.map((it, i) => (i === index ? { ...it, end: e.target.value } : it)))}
                                            aria-label={`${names[weekday]} ${index + 1}`}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => replaceDay(weekday, intervals.filter((_, i) => i !== index))}
                                            aria-label={t("agenda.professionals.removeInterval")}
                                        >
                                            <X />
                                        </Button>
                                        {index === intervals.length - 1 && (
                                            <Button type="button" variant="ghost" size="icon-sm" onClick={() => addInterval(weekday)} aria-label={t("agenda.professionals.addInterval")}>
                                                <Plus />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{t("agenda.professionals.hoursHint")}</p>
                <Button type="button" variant="outline" size="sm" onClick={copyMonday} disabled={ofDay(1).length === 0}>
                    <Copy /> {t("agenda.professionals.copyWeekdays")}
                </Button>
            </div>
        </div>
    );
}

/** "seg–sex 09:00–12:00, 13:00–18:00 · sáb 09:00–13:00" */
export function summarizeHours(hours: WorkingHour[], locale: string): string {
    const short = weekdayNames(locale, "short").map((d) => d.replace(".", ""));
    const groups: { days: number[]; text: string }[] = [];
    for (const weekday of DAY_ORDER) {
        const text = hours.filter((h) => h.weekday === weekday).map((h) => `${h.start}–${h.end}`).join(", ");
        if (!text) continue;
        const last = groups[groups.length - 1];
        const previousDay = last ? last.days[last.days.length - 1] : null;
        const consecutive = previousDay !== null && DAY_ORDER.indexOf(weekday) === DAY_ORDER.indexOf(previousDay) + 1;
        if (last && last.text === text && consecutive) last.days.push(weekday);
        else groups.push({ days: [weekday], text });
    }
    return groups
        .map((g) => `${g.days.length > 1 ? `${short[g.days[0]]}–${short[g.days[g.days.length - 1]]}` : short[g.days[0]]} ${g.text}`)
        .join(" · ");
}
