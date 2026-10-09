"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "./session-provider";
import { useTranslation } from "@/components/i18n-provider";
import { translateValue } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

/** Line status dot: green with a breathing ring when connected, amber while pairing, grey when stopped, red otherwise. */
export function StatusDot({ status, className }: { status?: string; className?: string }) {
    const tone =
        status === "CONNECTED" ? "signal-pulse bg-signal"
            : status === "SCAN_QR" || status === "CONNECTING" ? "bg-warning"
                : status === "STOPPED" ? "bg-muted-foreground"
                    : "bg-destructive";
    return (
        <span
            className={cn("inline-flex size-2 shrink-0 rounded-full", tone, className)}
            aria-hidden="true"
        />
    );
}

interface SessionSelectorProps {
    /** "sidebar": full-width block with the session ID and status; "bar": compact trigger for the top bar */
    variant?: "sidebar" | "bar";
    className?: string;
}

export function SessionSelector({ variant = "bar", className }: SessionSelectorProps) {
    const { sessions, sessionId, setSessionId, loading, refreshSessions } = useSession();
    const { t } = useTranslation();
    const selectedSession = sessions.find(s => s.sessionId === sessionId);
    const isSidebar = variant === "sidebar";

    return (
        <div className={cn("min-w-0", className)}>
            {isSidebar && (
                <div className="mb-1.5 flex items-center justify-between px-1">
                    <span id="active-session-label" className="text-xs font-medium text-muted-foreground">{t("session.active")}</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:text-foreground"
                        onClick={refreshSessions}
                        aria-label={t("session.refresh")}
                        title={t("session.refresh")}
                        disabled={loading}
                    >
                        <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden="true" />
                    </Button>
                </div>
            )}
            <Select value={sessionId} onValueChange={setSessionId} disabled={loading || sessions.length === 0}>
                <SelectTrigger
                    aria-label={isSidebar ? undefined : t("session.active")}
                    aria-labelledby={isSidebar ? "active-session-label" : undefined}
                    className={cn(
                        "w-full border-border",
                        isSidebar ? "h-auto min-h-12 rounded-lg bg-background px-3 py-2 dark:bg-background" : "h-9 max-w-[11rem] sm:max-w-[13rem]",
                    )}
                >
                    <SelectValue placeholder={loading ? t("common.loading") : t("session.select")}>
                        {selectedSession ? (
                            <span className="flex min-w-0 items-center gap-2.5 text-left">
                                <StatusDot status={selectedSession.status} />
                                <span className="flex min-w-0 flex-col">
                                    <span className="truncate text-sm font-medium leading-tight text-foreground">{selectedSession.name}</span>
                                    {isSidebar && (
                                        <span className="truncate text-xs leading-tight text-muted-foreground">
                                            {translateValue(t, "status", selectedSession.status)}
                                        </span>
                                    )}
                                </span>
                                {!isSidebar && <span className="sr-only">({translateValue(t, "status", selectedSession.status)})</span>}
                            </span>
                        ) : null}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent className="p-1">
                    {sessions.map((s) => (
                        <SelectItem key={s.sessionId} value={s.sessionId} className="cursor-pointer rounded-md py-2">
                            <span className="flex items-center gap-2.5">
                                <StatusDot status={s.status} />
                                <span className="flex flex-col">
                                    <span className="text-sm font-medium text-foreground">{s.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {translateValue(t, "status", s.status)}, ID {s.sessionId}
                                    </span>
                                </span>
                            </span>
                        </SelectItem>
                    ))}
                    {sessions.length === 0 && !loading && (
                        <div className="px-2 py-6 text-center text-xs text-muted-foreground">{t("session.noneFound")}</div>
                    )}
                </SelectContent>
            </Select>
        </div>
    );
}
