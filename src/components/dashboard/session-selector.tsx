"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "./session-provider";
import { useTranslation } from "@/components/i18n-provider";
import { translateValue } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

function StatusDot({ connected }: { connected: boolean }) {
    return (
        <span className="relative flex size-2 shrink-0" aria-hidden="true">
            {connected && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />}
            <span className={cn("relative inline-flex size-2 rounded-full", connected ? "bg-success" : "bg-destructive")} />
        </span>
    );
}

export function SessionSelector() {
    const { sessions, sessionId, setSessionId, loading, refreshSessions } = useSession();
    const { t } = useTranslation();
    const selectedSession = sessions.find(s => s.sessionId === sessionId);

    return (
        <div className="flex min-w-0 items-center gap-1">
            <span className="hidden text-xs font-medium text-muted-foreground lg:inline">{t("session.label")}</span>
            <div className="w-[9.5rem] min-w-0 sm:w-52">
                <Select value={sessionId} onValueChange={setSessionId} disabled={loading || sessions.length === 0}>
                    <SelectTrigger
                        aria-label={t("session.label")}
                        className="h-9 w-full rounded-md border-border bg-card"
                    >
                        <SelectValue placeholder={loading ? t("common.loading") : t("session.select")}>
                            {selectedSession ? (
                                <span className="flex min-w-0 items-center gap-2 text-left">
                                    <StatusDot connected={selectedSession.status === "CONNECTED"} />
                                    <span className="truncate text-sm font-medium">{selectedSession.name}</span>
                                    <span className="sr-only">({translateValue(t, "status", selectedSession.status)})</span>
                                </span>
                            ) : null}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="p-1">
                        {sessions.map((s) => (
                            <SelectItem key={s.sessionId} value={s.sessionId} className="cursor-pointer rounded-md py-2">
                                <span className="flex items-center gap-2">
                                    <StatusDot connected={s.status === "CONNECTED"} />
                                    <span className="flex flex-col">
                                        <span className="text-sm font-medium text-foreground">{s.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            <span className="font-mono">{s.sessionId}</span> · {translateValue(t, "status", s.status)}
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
            <Button
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={refreshSessions}
                aria-label={t("session.refresh")}
                title={t("session.refresh")}
                disabled={loading}
            >
                <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden="true" />
            </Button>
        </div>
    );
}
