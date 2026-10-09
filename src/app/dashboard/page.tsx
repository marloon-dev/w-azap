import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronRight, MessageSquare, Plus, QrCode, Settings2 } from "lucide-react";

import { auth } from "@/lib/auth";
import { getAccessibleSessions } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { translateValue } from "@/lib/i18n/translate";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SignalBars } from "@/components/dashboard/signal-bars";
import { cn } from "@/lib/utils";

export const dynamic = 'force-dynamic';

/** Counts that must not break the page when a table is missing or the query fails. */
async function safeCount(query: () => Promise<number>) {
    try {
        return await query();
    } catch {
        return 0;
    }
}

/** Start of the "last 24 hours" window (request time; this page is always rendered dynamically). */
function last24Hours() {
    return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

export default async function DashboardPage() {
    const { t } = await getTranslations();
    const session = await auth();
    if (!session?.user) {
        redirect("/login");
    }

    const sessions = await getAccessibleSessions(session.user.id!, session.user.role || "OWNER");

    const totalSessions = sessions.length;
    const connectedSessions = sessions.filter(s => s.status === 'CONNECTED').length;
    const disconnectedSessions = totalSessions - connectedSessions;

    // Related tables reference Session.id (CUID), not the public session slug
    const sessionIds = sessions.map(s => s.id);
    const scope = { sessionId: { in: sessionIds } };
    const since = last24Hours();
    const [autoReplyCount, webhookCount, messages24h, scheduledPending] = sessionIds.length === 0
        ? [0, 0, 0, 0]
        : await Promise.all([
            safeCount(() => prisma.autoReply.count({ where: scope })),
            safeCount(() => prisma.webhook.count({ where: scope })),
            safeCount(() => prisma.message.count({ where: { ...scope, timestamp: { gte: since } } })),
            safeCount(() => prisma.scheduledMessage.count({ where: { ...scope, status: "PENDING" } })),
        ]);

    const summary = [
        { label: t("home.connected"), value: connectedSessions, hint: t("home.ofTotal", { total: totalSessions }) },
        { label: t("home.messages24h"), value: messages24h },
        { label: t("home.autoReplyRules"), value: autoReplyCount },
        { label: t("home.scheduledPending"), value: scheduledPending },
    ];

    // Ordered by what blocks the user most; only what applies to their setup
    const steps = [
        totalSessions === 0 && { href: "/dashboard/sessions", title: t("home.stepConnect"), description: t("home.stepConnectDesc") },
        disconnectedSessions > 0 && totalSessions > 0 && { href: "/dashboard/sessions", title: t("home.stepReconnect"), description: t("home.stepReconnectDesc") },
        totalSessions > 0 && autoReplyCount === 0 && { href: "/dashboard/autoreply", title: t("home.stepAutoReply"), description: t("home.stepAutoReplyDesc") },
        totalSessions > 0 && webhookCount === 0 && { href: "/dashboard/webhooks", title: t("home.stepWebhook"), description: t("home.stepWebhookDesc") },
    ].filter(Boolean) as { href: string; title: string; description: string }[];

    return (
        <div className="mx-auto w-full max-w-6xl space-y-8">
            <PageHeader
                title={t("home.title")}
                description={t("home.subtitle")}
                actions={
                    <Button asChild>
                        <Link href="/dashboard/sessions">
                            <Plus aria-hidden="true" /> {t("home.addSession")}
                        </Link>
                    </Button>
                }
            />

            {/* Sessions: the state of every line comes first */}
            <section aria-labelledby="sessions-title" className="overflow-hidden rounded-xl border bg-card">
                <div className="flex items-center justify-between gap-2 border-b px-5 py-3.5">
                    <h2 id="sessions-title" className="text-sm font-semibold text-foreground">
                        {t("home.sessions")} <span className="font-normal text-muted-foreground" data-numeric>{totalSessions}</span>
                    </h2>
                    {totalSessions > 0 && (
                        <Link href="/dashboard/sessions" className="rounded-md text-sm font-medium text-primary hover:underline hover:underline-offset-4">
                            {t("home.viewAll")}
                        </Link>
                    )}
                </div>

                {sessions.length === 0 ? (
                    <EmptyState
                        icon={QrCode}
                        title={t("home.noSessions")}
                        description={t("home.noSessionsDesc")}
                        action={
                            <Button asChild>
                                <Link href="/dashboard/sessions">
                                    <Plus aria-hidden="true" /> {t("home.createSession")}
                                </Link>
                            </Button>
                        }
                    />
                ) : (
                    <ul className="divide-y">
                        {sessions.map(s => {
                            const isConnected = s.status === 'CONNECTED';
                            return (
                                <li key={s.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
                                    <div className="flex min-w-0 flex-1 items-center gap-4">
                                        <SignalBars status={s.status} className="h-5" />
                                        <div className="min-w-0">
                                            <p className="truncate text-lg font-semibold leading-tight tracking-tight text-foreground">{s.name}</p>
                                            <p className="mt-0.5 truncate text-sm text-muted-foreground">
                                                <span className={cn("font-medium", isConnected ? "text-success" : s.status === "SCAN_QR" ? "text-warning" : "text-muted-foreground")}>
                                                    {translateValue(t, "status", s.status)}
                                                </span>
                                                <span className="mx-2 text-border" aria-hidden="true">|</span>
                                                <span data-numeric>{t("home.sessionId", { id: s.sessionId })}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2 pl-9 sm:pl-0">
                                        {isConnected ? (
                                            <Button asChild variant="outline" size="sm">
                                                <Link href="/dashboard/chat">
                                                    <MessageSquare aria-hidden="true" /> {t("home.openChats")}
                                                </Link>
                                            </Button>
                                        ) : (
                                            <Button asChild size="sm">
                                                <Link href={`/dashboard/sessions/${s.sessionId}`}>
                                                    <QrCode aria-hidden="true" /> {t("home.reconnect")}
                                                </Link>
                                            </Button>
                                        )}
                                        <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                                            <Link href={`/dashboard/sessions/${s.sessionId}`}>
                                                <Settings2 aria-hidden="true" /> {t("home.manage")}
                                            </Link>
                                        </Button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            {/* One strip of figures instead of a grid of identical cards */}
            <section aria-label={t("home.summary")} className="grid grid-cols-2 rounded-xl border bg-card lg:grid-cols-4">
                {summary.map((item, index) => (
                    <div
                        key={item.label}
                        className={cn(
                            "px-5 py-4",
                            index % 2 === 1 && "border-l",
                            index >= 2 && "border-t lg:border-t-0",
                            index === 2 && "lg:border-l",
                        )}
                    >
                        <p className="text-sm text-muted-foreground">{item.label}</p>
                        <p className="mt-1 flex items-baseline gap-2">
                            <span className="text-3xl font-semibold tracking-tight text-foreground" data-numeric>{item.value}</span>
                            {item.hint && <span className="text-sm text-muted-foreground" data-numeric>{item.hint}</span>}
                        </p>
                    </div>
                ))}
            </section>

            {/* Next steps: only what this setup is missing */}
            <section aria-labelledby="next-steps-title">
                <h2 id="next-steps-title" className="mb-3 text-sm font-semibold text-foreground">{t("home.nextSteps")}</h2>
                {steps.length === 0 ? (
                    <p className="rounded-xl border border-dashed px-5 py-4 text-sm text-muted-foreground">{t("home.allSet")}</p>
                ) : (
                    <ul className="divide-y rounded-xl border bg-card">
                        {steps.slice(0, 3).map((step) => (
                            <li key={step.title}>
                                <Link href={step.href} className="group flex items-center gap-4 px-5 py-3.5 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-muted/40">
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-medium text-foreground">{step.title}</span>
                                        <span className="block text-sm text-muted-foreground">{step.description}</span>
                                    </span>
                                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
