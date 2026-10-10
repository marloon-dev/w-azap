"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Hand, MessageSquare, Play } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { urlSegmentFromJid } from "@/lib/chat-jid";
import { agendaRequest } from "./api";

interface PausedChat {
    jid: string;
    name: string | null;
    phone: string;
    pausedUntil: string;
}

const fetchPaused = (sessionId: string) => agendaRequest<PausedChat[]>(sessionId, "conversations");

/** Chats a person took over, with a button to hand them back to the assistant. */
export function PausedChats({ sessionId }: { sessionId: string }) {
    const { t, locale } = useTranslation();
    const [chats, setChats] = useState<PausedChat[] | null>(null);

    const apply = useCallback((res: Awaited<ReturnType<typeof fetchPaused>>) => setChats(res.data ?? []), []);

    useEffect(() => {
        fetchPaused(sessionId).then(apply);
        const timer = setInterval(() => fetchPaused(sessionId).then(apply), 60_000);
        return () => clearInterval(timer);
    }, [sessionId, apply]);

    const resume = async (jid: string) => {
        const res = await agendaRequest(sessionId, `conversations?jid=${encodeURIComponent(jid)}`, { method: "DELETE" });
        if (!res.ok) return toast.error(res.message || t("agenda.common.saveFailed"));
        toast.success(t("agenda.assistant.paused.resumed"));
        fetchPaused(sessionId).then(apply);
    };

    const until = (iso: string) => new Intl.DateTimeFormat(locale, { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Hand className="size-4" /> {t("agenda.assistant.paused.title")}</CardTitle>
                <CardDescription>{t("agenda.assistant.paused.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
                {chats === null ? null : chats.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("agenda.assistant.paused.empty")}</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {chats.map((chat) => (
                            <li key={chat.jid} className="flex items-center gap-2 py-2.5">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{chat.name || chat.phone}</p>
                                    <p className="truncate text-xs text-muted-foreground">{t("agenda.assistant.paused.until", { when: until(chat.pausedUntil) })}</p>
                                </div>
                                {!chat.jid.endsWith("@agenda.local") && (
                                    <Button asChild variant="ghost" size="icon-sm" aria-label={t("agenda.appointments.actions.openChat")}>
                                        <Link href={`/dashboard/chat/${urlSegmentFromJid(chat.jid)}`}><MessageSquare /></Link>
                                    </Button>
                                )}
                                <Button variant="outline" size="sm" onClick={() => resume(chat.jid)}><Play /> {t("agenda.assistant.paused.resume")}</Button>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
