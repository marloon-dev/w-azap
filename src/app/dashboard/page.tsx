import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
    Plus,
    Wifi,
    WifiOff,
    Bot,
    Send,
    QrCode,
    ArrowRight,
    Activity,
    Zap,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { getAccessibleSessions } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { translateValue } from "@/lib/i18n/translate";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const { t } = await getTranslations();
    const session = await auth();
    if (!session?.user) {
        redirect("/login");
    }

    const sessions = await getAccessibleSessions(session.user.id!, session.user.role || "OWNER");

    const totalSessions = sessions.length;
    const connectedSessions = sessions.filter(s => s.status === 'CONNECTED').length;
    const disconnectedSessions = totalSessions - connectedSessions; // Anything not connected is disconnected

    // Fetch auto-reply count for accessible sessions
    let autoReplyCount = 0;
    try {
        // AutoReply.sessionId references Session.id (CUID), not the public session slug
        const sessionIds = sessions.map(s => s.id);
        if (sessionIds.length > 0) {
            autoReplyCount = await prisma.autoReply.count({
                where: { sessionId: { in: sessionIds } }
            });
        }
    } catch {
        // If auto-reply table doesn't exist yet, just show 0
    }

    const stats = [
        {
            title: t("home.totalSessions"),
            value: totalSessions,
            icon: QrCode,
            description: t("home.totalSessionsDesc"),
            color: "text-info",
            bg: "bg-info/10",
        },
        {
            title: t("home.connected"),
            value: connectedSessions,
            icon: Wifi,
            description: t("home.connectedDesc"),
            color: "text-success",
            bg: "bg-success/10",
        },
        {
            title: t("home.disconnected"),
            value: disconnectedSessions,
            icon: WifiOff,
            description: t("home.disconnectedDesc"),
            color: "text-destructive",
            bg: "bg-destructive/10",
        },
        {
            title: t("home.autoReplyRules"),
            value: autoReplyCount,
            icon: Zap,
            description: t("home.autoReplyRulesDesc"),
            color: "text-warning",
            bg: "bg-warning/10",
        },
    ];

    const quickActions = [
        { href: "/dashboard/sessions", label: t("home.newSession"), icon: Plus, description: t("home.newSessionDesc") },
        { href: "/dashboard/chat", label: t("home.sendMessage"), icon: Send, description: t("home.sendMessageDesc") },
        { href: "/dashboard/bot-settings", label: t("home.botSettings"), icon: Bot, description: t("home.botSettingsDesc") },
        { href: "/dashboard/system-monitor", label: t("home.systemMonitor"), icon: Activity, description: t("home.systemMonitorDesc") },
    ];

    return (
        <div className="mx-auto w-full max-w-7xl space-y-8">
            <PageHeader
                title={t("home.title")}
                description={t("home.subtitle")}
                actions={
                    <Button asChild size="sm" className="gap-2">
                        <Link href="/dashboard/sessions">
                            <Plus className="size-4" aria-hidden="true" /> {t("home.addSession")}
                        </Link>
                    </Button>
                }
            />

            {/* Stats */}
            <section aria-label={t("home.sessions")} className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={stat.title} className="gap-0 py-0">
                            <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
                                <div className="min-w-0 space-y-1">
                                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                                    <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">{stat.value}</p>
                                    <p className="text-xs text-muted-foreground">{stat.description}</p>
                                </div>
                                <span className={`${stat.bg} flex size-10 shrink-0 items-center justify-center rounded-lg`} aria-hidden="true">
                                    <Icon className={`size-5 ${stat.color}`} />
                                </span>
                            </CardContent>
                        </Card>
                    );
                })}
            </section>

            {/* Quick actions */}
            <section aria-labelledby="quick-actions-title">
                <h2 id="quick-actions-title" className="mb-3 text-base font-semibold text-foreground">{t("home.quickActions")}</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {quickActions.map((action) => {
                        const Icon = action.icon;
                        return (
                            <Link
                                key={action.href}
                                href={action.href}
                                className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-primary/40 hover:bg-accent/50"
                            >
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground" aria-hidden="true">
                                    <Icon className="size-5" />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-medium text-foreground">{action.label}</span>
                                    <span className="block text-xs text-muted-foreground">{action.description}</span>
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </section>

            {/* Sessions */}
            <section aria-labelledby="sessions-title">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 id="sessions-title" className="text-base font-semibold text-foreground">{t("home.sessions")}</h2>
                    <Link href="/dashboard/sessions" className="flex items-center gap-1 rounded-md text-sm font-medium text-primary transition-colors hover:text-primary/80">
                        {t("home.viewAll")} <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                </div>

                {sessions.length === 0 ? (
                    <Card className="border-dashed py-0 shadow-none">
                        <EmptyState
                            icon={QrCode}
                            title={t("home.noSessions")}
                            description={t("home.noSessionsDesc")}
                            action={
                                <Button asChild size="sm" className="gap-2">
                                    <Link href="/dashboard/sessions">
                                        <Plus className="size-4" aria-hidden="true" /> {t("home.createSession")}
                                    </Link>
                                </Button>
                            }
                        />
                    </Card>
                ) : (
                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {sessions.map(s => {
                            const isConnected = s.status === 'CONNECTED';
                            return (
                                <li key={s.id}>
                                    <Link
                                        href={`/dashboard/sessions/${s.sessionId}`}
                                        className="flex h-full items-start justify-between gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-primary/40 hover:bg-accent/50"
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold text-foreground">{s.name}</span>
                                            <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">{s.sessionId}</span>
                                        </span>
                                        <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${isConnected ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                                            <span className={`size-1.5 rounded-full ${isConnected ? 'bg-success' : 'bg-destructive'}`} aria-hidden="true" />
                                            {translateValue(t, "status", s.status)}
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
}
