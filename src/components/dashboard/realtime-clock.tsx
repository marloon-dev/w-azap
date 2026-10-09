"use client";

import { useEffect, useState } from "react";
import moment from "moment-timezone";
import { useTranslation } from "@/components/i18n-provider";

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/** "America/Sao_Paulo" -> "Sao Paulo" */
function cityOf(timezone: string) {
    return timezone.split("/").pop()?.replace(/_/g, " ") ?? timezone;
}

/** Server time in the system timezone (Settings), which is the clock schedules and logs follow. */
export function RealtimeClock() {
    const { t } = useTranslation();
    const [time, setTime] = useState("");
    const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        fetch("/api/settings/system")
            .then(r => r.json())
            .then(data => {
                if (data?.data?.timezone) setTimezone(data.data.timezone);
            })
            .catch(() => { });
    }, []);

    useEffect(() => {
        if (!mounted) return;
        const updateTime = () => setTime(moment().tz(timezone).format("HH:mm"));
        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, [timezone, mounted]);

    if (!mounted) return null;

    return (
        <span
            className="inline-flex items-baseline gap-1.5 text-sm text-muted-foreground"
            title={t("common.timeIn", { timezone })}
        >
            <time className="font-medium text-foreground" data-numeric>{time}</time>
            <span className="text-xs">{cityOf(timezone)}</span>
        </span>
    );
}
