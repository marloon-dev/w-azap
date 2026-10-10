"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { MessageSquare, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { agendaRequest } from "./api";

interface Bubble {
    from: "customer" | "assistant" | "system";
    text: string;
}

/** WhatsApp-style *bold* inside the assistant's text */
function WhatsAppText({ text }: { text: string }) {
    const parts = text.split(/(\*[^*\n]+\*)/g);
    return (
        <>
            {parts.map((part, i) =>
                part.startsWith("*") && part.endsWith("*") && part.length > 2 ? <strong key={i}>{part.slice(1, -1)}</strong> : <Fragment key={i}>{part}</Fragment>,
            )}
        </>
    );
}

/** Chat with the real assistant as a test customer (the server runs exactly what WhatsApp runs). */
export function AssistantSimulator({ sessionId, dirty }: { sessionId: string; dirty: boolean }) {
    const { t } = useTranslation();
    const [bubbles, setBubbles] = useState<Bubble[]>([]);
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }, [bubbles, busy]);

    const send = async (message: string, reset = false) => {
        setBusy(true);
        if (message) setBubbles((prev) => [...(reset ? [] : prev), { from: "customer", text: message }]);
        else if (reset) setBubbles([]);
        const res = await agendaRequest<{ replies: string[]; paused: boolean }>(sessionId, "simulate", { method: "POST", body: { text: message, reset } });
        setBusy(false);
        if (!res.ok || !res.data) {
            toast.error(res.message || t("agenda.assistant.simulator.failed"));
            return;
        }
        const { replies, paused } = res.data;
        setBubbles((prev) => [
            ...prev,
            ...replies.map((reply) => ({ from: "assistant" as const, text: reply })),
            ...(paused ? [{ from: "system" as const, text: t("agenda.assistant.simulator.paused") }] : []),
        ]);
    };

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        const message = text.trim();
        if (!message || busy) return;
        setText("");
        send(message);
    };

    return (
        <Card className="flex h-[640px] max-h-[80vh] flex-col gap-0 overflow-hidden py-0">
            <CardHeader className="flex flex-row items-start justify-between gap-2 border-b border-border py-4">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="size-4" /> {t("agenda.assistant.simulator.title")}</CardTitle>
                    <CardDescription>{t("agenda.assistant.simulator.desc")}</CardDescription>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => send("", true)} disabled={busy} aria-label={t("agenda.assistant.simulator.restart")} title={t("agenda.assistant.simulator.restart")}>
                    <RotateCcw />
                </Button>
            </CardHeader>
            <CardContent ref={listRef} className="flex-1 space-y-2 overflow-y-auto bg-muted/40 p-4" aria-live="polite">
                {dirty && <p className="rounded-md bg-warning/12 px-3 py-2 text-xs text-warning">{t("agenda.assistant.simulator.unsaved")}</p>}
                {bubbles.length === 0 && !busy && <p className="pt-10 text-center text-sm text-muted-foreground">{t("agenda.assistant.simulator.empty")}</p>}
                {bubbles.map((bubble, i) =>
                    bubble.from === "system" ? (
                        <p key={i} className="mx-auto max-w-[90%] rounded-md bg-info/12 px-3 py-2 text-center text-xs text-info">{bubble.text}</p>
                    ) : (
                        <div key={i} className={`flex ${bubble.from === "customer" ? "justify-end" : "justify-start"}`}>
                            <div
                                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm shadow-xs ${
                                    bubble.from === "customer" ? "rounded-br-sm bg-bubble-out text-foreground" : "rounded-bl-sm bg-card text-card-foreground"
                                }`}
                            >
                                <WhatsAppText text={bubble.text} />
                            </div>
                        </div>
                    ),
                )}
                {busy && (
                    <div className="flex justify-start">
                        <div className="flex gap-1 rounded-lg rounded-bl-sm bg-card px-3 py-3 shadow-xs" aria-hidden="true">
                            {[0, 150, 300].map((delay) => <span key={delay} className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${delay}ms` }} />)}
                        </div>
                    </div>
                )}
            </CardContent>
            <form onSubmit={submit} className="flex gap-2 border-t border-border p-3">
                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("agenda.assistant.simulator.placeholder")} maxLength={2000} aria-label={t("agenda.assistant.simulator.placeholder")} />
                <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label={t("agenda.assistant.simulator.send")}><Send /></Button>
            </form>
        </Card>
    );
}
