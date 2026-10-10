"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    CalendarCheck,
    CalendarDays,
    Check,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Circle,
    MessageSquare,
    MonitorSmartphone,
    MoreHorizontal,
    Plus,
    RotateCcw,
    Smartphone,
    UserX,
    XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/dashboard/session-provider";
import { SessionGuard } from "@/components/dashboard/session-guard";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { useTranslation } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AppointmentDialog } from "@/components/agenda/appointment-dialog";
import { agendaRequest, dayIn, formatDayLong, formatMoney, shiftDay, timeIn, todayIn, weekStart, weekdayNames } from "@/components/agenda/api";
import type { AgendaAppointment, AgendaProfessional, AgendaService, AgendaSettings, AppointmentStatus } from "@/components/agenda/types";
import { urlSegmentFromJid } from "@/lib/chat-jid";
import { cn } from "@/lib/utils";

const ALL = "all";

const STATUS_VARIANT: Record<AppointmentStatus, "info" | "success" | "muted" | "danger" | "warning"> = {
    BOOKED: "info",
    CONFIRMED: "success",
    COMPLETED: "muted",
    CANCELLED: "danger",
    NO_SHOW: "warning",
};

interface WeekData {
    week: string;
    timezone: string;
    today: string;
    appointments: AgendaAppointment[];
}

const fetchBase = (id: string) =>
    Promise.all([
        agendaRequest<AgendaService[]>(id, "services"),
        agendaRequest<AgendaProfessional[]>(id, "professionals"),
        agendaRequest<AgendaSettings>(id, "config"),
    ]);

const fetchWeek = (id: string, start: string) =>
    agendaRequest<{ timezone: string; today: string; appointments: AgendaAppointment[] }>(id, `appointments?from=${start}&to=${shiftDay(start, 6)}`);

function SetupChecklist({ services, professionals, enabled }: { services: number; professionals: number; enabled: boolean }) {
    const { t } = useTranslation();
    const steps = [
        { done: services > 0, title: t("agenda.setup.services"), desc: t("agenda.setup.servicesDesc"), href: "/dashboard/agenda/services" },
        { done: professionals > 0, title: t("agenda.setup.professionals"), desc: t("agenda.setup.professionalsDesc"), href: "/dashboard/agenda/professionals" },
        { done: enabled, title: t("agenda.setup.assistant"), desc: t("agenda.setup.assistantDesc"), href: "/dashboard/agenda/assistant" },
    ];
    if (steps.every((s) => s.done)) return null;
    return (
        <Card className="mb-6 border-primary/30">
            <CardHeader>
                <CardTitle>{t("agenda.setup.title")}</CardTitle>
                <CardDescription>{t("agenda.setup.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
                <ol className="grid gap-3 md:grid-cols-3">
                    {steps.map((step, i) => (
                        <li key={step.href} className={cn("flex gap-3 rounded-lg border border-border p-3", step.done && "bg-muted/50")}>
                            {step.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> : <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />}
                            <div className="min-w-0 flex-1 space-y-1">
                                <p className="text-sm font-medium">{i + 1}. {step.title}</p>
                                <p className="text-xs text-muted-foreground">{step.desc}</p>
                                {!step.done && (
                                    <Button asChild size="sm" variant="outline" className="mt-1">
                                        <Link href={step.href}>{t("agenda.setup.go")}</Link>
                                    </Button>
                                )}
                            </div>
                        </li>
                    ))}
                </ol>
            </CardContent>
        </Card>
    );
}

export default function AgendaPage() {
    const { sessionId } = useSession();
    const { t, locale } = useTranslation();
    const [services, setServices] = useState<AgendaService[]>([]);
    const [professionals, setProfessionals] = useState<AgendaProfessional[]>([]);
    const [settings, setSettings] = useState<AgendaSettings | null>(null);
    const [baseFor, setBaseFor] = useState<string | null>(null);
    const [day, setDay] = useState<string | null>(null);
    const [week, setWeek] = useState<WeekData | null>(null);
    const [filter, setFilter] = useState(ALL);
    const [showCancelled, setShowCancelled] = useState(false);
    const [dialog, setDialog] = useState<{ key: number; reschedule: AgendaAppointment | null } | null>(null);
    const [cancelling, setCancelling] = useState<AgendaAppointment | null>(null);
    const [notifyOnCancel, setNotifyOnCancel] = useState(true);

    const timezone = settings?.timezone ?? week?.timezone ?? "America/Sao_Paulo";
    const currentDay = day ?? todayIn(timezone);
    const currentWeek = weekStart(currentDay);

    const applyBase = useCallback(([s, p, c]: Awaited<ReturnType<typeof fetchBase>>, id: string) => {
        if (!s.ok || !p.ok || !c.ok) toast.error(s.message || p.message || c.message || t("agenda.common.loadFailed"));
        setServices(s.data ?? []);
        setProfessionals(p.data ?? []);
        setSettings(c.data);
        setBaseFor(id);
    }, [t]);

    const applyWeek = useCallback((res: Awaited<ReturnType<typeof fetchWeek>>, key: string) => {
        if (!res.ok || !res.data) {
            toast.error(res.message || t("agenda.common.loadFailed"));
            return;
        }
        setWeek({ week: key, ...res.data });
    }, [t]);
    const loadWeek = useCallback((id: string, start: string) => fetchWeek(id, start).then((res) => applyWeek(res, `${id}:${start}`)), [applyWeek]);

    useEffect(() => {
        if (sessionId) fetchBase(sessionId).then((data) => applyBase(data, sessionId));
    }, [sessionId, applyBase]);

    useEffect(() => {
        if (sessionId) fetchWeek(sessionId, currentWeek).then((res) => applyWeek(res, `${sessionId}:${currentWeek}`));
    }, [sessionId, currentWeek, applyWeek]);

    // Keep the screen fresh: WhatsApp bookings arrive at any time
    useEffect(() => {
        if (!sessionId) return;
        const timer = setInterval(() => loadWeek(sessionId, currentWeek), 30_000);
        return () => clearInterval(timer);
    }, [sessionId, currentWeek, loadWeek]);

    const loading = baseFor !== sessionId || week?.week !== `${sessionId}:${currentWeek}`;
    const reload = () => sessionId && loadWeek(sessionId, currentWeek);

    const visible = useMemo(
        () => (week?.appointments ?? []).filter((a) => (filter === ALL || a.professionalId === filter) && (showCancelled || a.status !== "CANCELLED")),
        [week, filter, showCancelled],
    );
    const ofDay = visible.filter((a) => dayIn(a.startsAt, timezone) === currentDay);
    const weekDays = Array.from({ length: 7 }, (_, i) => shiftDay(currentWeek, i));
    const shortNames = weekdayNames(locale, "short");
    const today = todayIn(timezone);

    const byProfessional = useMemo(() => {
        const groups = new Map<string, { name: string; items: AgendaAppointment[] }>();
        for (const a of ofDay) {
            const group = groups.get(a.professionalId) ?? { name: a.professional.name, items: [] };
            group.items.push(a);
            groups.set(a.professionalId, group);
        }
        return [...groups.entries()];
    }, [ofDay]);

    const setStatus = async (appointment: AgendaAppointment, status: AppointmentStatus) => {
        if (!sessionId) return;
        const res = await agendaRequest(sessionId, `appointments/${appointment.id}`, { method: "PATCH", body: { action: "status", status } });
        if (!res.ok) return toast.error(res.message || t("agenda.common.saveFailed"));
        toast.success(t("agenda.appointments.updated"));
        reload();
    };

    const confirmCancel = async () => {
        if (!sessionId || !cancelling) return;
        const res = await agendaRequest(sessionId, `appointments/${cancelling.id}`, { method: "PATCH", body: { action: "cancel", notifyCustomer: notifyOnCancel } });
        setCancelling(null);
        if (!res.ok) return toast.error(res.message || t("agenda.common.saveFailed"));
        toast.success(t("agenda.appointments.cancelled"));
        reload();
    };

    const openNew = () => setDialog({ key: Date.now(), reschedule: null });
    const countLabel = (count: number) => (count === 1 ? t("agenda.appointments.dayCountOne") : t("agenda.appointments.dayCount", { count }));

    return (
        <SessionGuard>
            <PageHeader
                title={t("agenda.appointments.title")}
                description={t("agenda.appointments.subtitle")}
                icon={CalendarDays}
                actions={<Button onClick={openNew} disabled={baseFor !== sessionId || services.length === 0 || professionals.length === 0}><Plus /> {t("agenda.appointments.new")}</Button>}
            />

            {baseFor === sessionId && <SetupChecklist services={services.length} professionals={professionals.length} enabled={!!settings?.enabled} />}

            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="icon-sm" onClick={() => setDay(shiftDay(currentDay, -1))} aria-label={t("agenda.appointments.previousDay")}><ChevronLeft /></Button>
                    <Button variant="outline" size="sm" onClick={() => setDay(today)} disabled={currentDay === today}>{t("agenda.appointments.today")}</Button>
                    <Button variant="outline" size="icon-sm" onClick={() => setDay(shiftDay(currentDay, 1))} aria-label={t("agenda.appointments.nextDay")}><ChevronRight /></Button>
                    <Input type="date" value={currentDay} onChange={(e) => e.target.value && setDay(e.target.value)} className="h-8 w-40" aria-label={t("agenda.appointments.form.date")} />
                    <h2 className="ml-1 text-base font-semibold first-letter:uppercase">{formatDayLong(currentDay, locale)}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Switch checked={showCancelled} onCheckedChange={setShowCancelled} /> {t("agenda.appointments.showCancelled")}
                    </label>
                    <Select value={filter} onValueChange={setFilter}>
                        <SelectTrigger className="h-8 w-52"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>{t("agenda.common.allProfessionals")}</SelectItem>
                            {professionals.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="mb-6 grid grid-cols-7 gap-1.5" role="tablist" aria-label={t("agenda.appointments.title")}>
                {weekDays.map((d) => {
                    const count = visible.filter((a) => dayIn(a.startsAt, timezone) === d && a.status !== "CANCELLED").length;
                    const selected = d === currentDay;
                    return (
                        <button
                            key={d}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            onClick={() => setDay(d)}
                            className={cn(
                                "flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-xs transition-colors",
                                selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent",
                                d === today && !selected && "border-primary/50",
                            )}
                        >
                            <span className="capitalize opacity-80">{shortNames[new Date(`${d}T12:00:00Z`).getUTCDay()].replace(".", "")}</span>
                            <span className="text-base font-semibold leading-none">{d.slice(8)}</span>
                            <span className={cn("mt-0.5 h-4 min-w-4 rounded-full px-1 text-[10px] font-semibold leading-4", count ? (selected ? "bg-primary-foreground/20" : "bg-primary/10 text-primary") : "opacity-0")}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
            ) : ofDay.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={CalendarCheck}
                        title={t("agenda.appointments.empty")}
                        description={t("agenda.appointments.emptyHint")}
                        action={services.length > 0 && professionals.length > 0 ? <Button variant="outline" onClick={openNew}><Plus /> {t("agenda.appointments.new")}</Button> : undefined}
                    />
                </Card>
            ) : (
                <div className="space-y-6">
                    {byProfessional.map(([professionalId, group]) => (
                        <section key={professionalId} aria-labelledby={`pro-${professionalId}`}>
                            <h3 id={`pro-${professionalId}`} className="mb-2 flex items-center gap-2 text-sm font-semibold">
                                {group.name}
                                <Badge variant="muted">{countLabel(group.items.filter((a) => a.status !== "CANCELLED").length)}</Badge>
                            </h3>
                            <Card className="py-0">
                                <ul className="divide-y divide-border">
                                    {group.items.map((a) => {
                                        const inactive = a.status === "CANCELLED" || a.status === "NO_SHOW";
                                        const simulated = a.customerJid.endsWith("@agenda.local");
                                        const price = formatMoney(a.priceCents, locale);
                                        return (
                                            <li key={a.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 p-4", inactive && "opacity-60")}>
                                                <div className="w-14 shrink-0">
                                                    <p className={cn("text-lg font-semibold tabular-nums leading-tight", a.status === "CANCELLED" && "line-through")}>{timeIn(a.startsAt, timezone)}</p>
                                                    <p className="text-xs text-muted-foreground tabular-nums">– {timeIn(a.endsAt, timezone)}</p>
                                                </div>
                                                <div className="min-w-0 flex-1 basis-48">
                                                    <p className="truncate font-medium">{a.customerName || a.customerPhone}</p>
                                                    <p className="truncate text-sm text-muted-foreground">
                                                        {[a.service.name, price, a.customerName ? a.customerPhone : null].filter(Boolean).join(" · ")}
                                                    </p>
                                                    {a.notes && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.notes}</p>}
                                                </div>
                                                <div className="ml-auto flex items-center gap-2">
                                                    <span title={t(`agenda.appointments.source.${a.source}`)} className="text-muted-foreground">
                                                        {a.source === "WHATSAPP" ? <Smartphone className="size-4" /> : <MonitorSmartphone className="size-4" />}
                                                    </span>
                                                    <Badge variant={STATUS_VARIANT[a.status]}>{t(`agenda.appointments.status.${a.status}`)}</Badge>
                                                    {(a.status === "BOOKED" || a.status === "CONFIRMED") && (
                                                        <Button variant="ghost" size="icon-sm" onClick={() => setStatus(a, "COMPLETED")} aria-label={t("agenda.appointments.actions.complete")} title={t("agenda.appointments.actions.complete")}>
                                                            <Check />
                                                        </Button>
                                                    )}
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="ghost" size="icon-sm" aria-label={t("agenda.appointments.actions.more")}><MoreHorizontal /></Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent align="end" className="w-60 p-1">
                                                            <div className="flex flex-col">
                                                                {a.status === "BOOKED" && (
                                                                    <MenuButton icon={CheckCircle2} onClick={() => setStatus(a, "CONFIRMED")}>{t("agenda.appointments.actions.confirm")}</MenuButton>
                                                                )}
                                                                {(a.status === "BOOKED" || a.status === "CONFIRMED") && (
                                                                    <>
                                                                        <MenuButton icon={Check} onClick={() => setStatus(a, "COMPLETED")}>{t("agenda.appointments.actions.complete")}</MenuButton>
                                                                        <MenuButton icon={UserX} onClick={() => setStatus(a, "NO_SHOW")}>{t("agenda.appointments.actions.noShow")}</MenuButton>
                                                                        <MenuButton icon={CalendarDays} onClick={() => setDialog({ key: Date.now(), reschedule: a })}>{t("agenda.appointments.actions.reschedule")}</MenuButton>
                                                                    </>
                                                                )}
                                                                {(a.status === "COMPLETED" || a.status === "NO_SHOW") && (
                                                                    <MenuButton icon={RotateCcw} onClick={() => setStatus(a, "BOOKED")}>{t("agenda.appointments.actions.reopen")}</MenuButton>
                                                                )}
                                                                {!simulated && (
                                                                    <MenuButton icon={MessageSquare} href={`/dashboard/chat/${urlSegmentFromJid(a.customerJid)}`}>{t("agenda.appointments.actions.openChat")}</MenuButton>
                                                                )}
                                                                {(a.status === "BOOKED" || a.status === "CONFIRMED") && (
                                                                    <MenuButton icon={XCircle} destructive onClick={() => { setNotifyOnCancel(!simulated); setCancelling(a); }}>
                                                                        {t("agenda.appointments.actions.cancel")}
                                                                    </MenuButton>
                                                                )}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </Card>
                        </section>
                    ))}
                </div>
            )}

            {dialog && sessionId && (
                <AppointmentDialog
                    key={dialog.key}
                    open
                    sessionId={sessionId}
                    timezone={timezone}
                    services={services}
                    professionals={professionals}
                    day={currentDay}
                    reschedule={dialog.reschedule}
                    onClose={() => setDialog(null)}
                    onDone={() => {
                        setDialog(null);
                        reload();
                    }}
                />
            )}

            <AlertDialog open={!!cancelling} onOpenChange={(open) => !open && setCancelling(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("agenda.appointments.cancelTitle")}</AlertDialogTitle>
                        {cancelling && (
                            <AlertDialogDescription>
                                {cancelling.customerName || cancelling.customerPhone} · {cancelling.service.name} · {formatDayLong(dayIn(cancelling.startsAt, timezone), locale)} {timeIn(cancelling.startsAt, timezone)}
                            </AlertDialogDescription>
                        )}
                    </AlertDialogHeader>
                    <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={notifyOnCancel} onCheckedChange={(v) => setNotifyOnCancel(v === true)} /> {t("agenda.appointments.notifyCustomer")}
                    </label>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("agenda.appointments.keep")}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("agenda.appointments.actions.cancel")}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </SessionGuard>
    );
}

function MenuButton({ icon: Icon, children, onClick, href, destructive }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; onClick?: () => void; href?: string; destructive?: boolean }) {
    const className = cn("flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent", destructive && "text-destructive");
    if (href) {
        return <Link href={href} className={className}><Icon className="size-4" /> {children}</Link>;
    }
    return <button type="button" onClick={onClick} className={className}><Icon className="size-4" /> {children}</button>;
}
