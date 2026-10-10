"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarOff, Globe, Plus, Store, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/dashboard/session-provider";
import { SessionGuard } from "@/components/dashboard/session-guard";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { useTranslation } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDelete } from "@/components/agenda/confirm-delete";
import { agendaRequest, dayIn, formatDayShort, shiftDay, timeIn, todayIn, zonedIso } from "@/components/agenda/api";
import type { AgendaBlock, AgendaProfessional, AgendaSettings } from "@/components/agenda/types";

const EVERYONE = "all";

interface FormState {
    who: string;
    allDay: boolean;
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    reason: string;
}

const fetchData = (id: string, past: boolean) =>
    Promise.all([
        agendaRequest<AgendaBlock[]>(id, `blocks${past ? "?past=1" : ""}`),
        agendaRequest<AgendaProfessional[]>(id, "professionals"),
        agendaRequest<AgendaSettings>(id, "config"),
    ]);

export default function AgendaBlocksPage() {
    const { sessionId } = useSession();
    const { t, locale } = useTranslation();
    const [blocks, setBlocks] = useState<AgendaBlock[]>([]);
    const [professionals, setProfessionals] = useState<AgendaProfessional[]>([]);
    const [timezone, setTimezone] = useState("America/Sao_Paulo");
    const [showPast, setShowPast] = useState(false);
    const [loadedFor, setLoadedFor] = useState<string | null>(null);
    const [form, setForm] = useState<FormState | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<AgendaBlock | null>(null);

    const apply = useCallback(([b, p, c]: Awaited<ReturnType<typeof fetchData>>, key: string) => {
        if (!b.ok) toast.error(b.message || t("agenda.common.loadFailed"));
        setBlocks(b.data ?? []);
        setProfessionals(p.data ?? []);
        if (c.data?.timezone) setTimezone(c.data.timezone);
        setLoadedFor(key);
    }, [t]);
    const load = (id: string, past: boolean) => fetchData(id, past).then((data) => apply(data, `${id}:${past}`));

    useEffect(() => {
        if (sessionId) fetchData(sessionId, showPast).then((data) => apply(data, `${sessionId}:${showPast}`));
    }, [sessionId, showPast, apply]);

    const loading = loadedFor !== `${sessionId}:${showPast}`;
    const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

    const openNew = () => {
        const today = todayIn(timezone);
        setForm({ who: EVERYONE, allDay: true, startDate: today, endDate: today, startTime: "12:00", endTime: "13:00", reason: "" });
    };

    const save = async () => {
        if (!sessionId || !form) return;
        const startsAt = zonedIso(form.startDate, form.allDay ? "00:00" : form.startTime, timezone);
        const endsAt = form.allDay ? zonedIso(shiftDay(form.endDate, 1), "00:00", timezone) : zonedIso(form.endDate, form.endTime, timezone);
        if (new Date(endsAt) <= new Date(startsAt)) return toast.error(t("agenda.blocks.invalidRange"));

        setSaving(true);
        const res = await agendaRequest<{ conflicts: number }>(sessionId, "blocks", {
            method: "POST",
            body: { professionalId: form.who === EVERYONE ? null : form.who, startsAt, endsAt, reason: form.reason || null },
        });
        setSaving(false);
        if (!res.ok) return toast.error(res.message || t("agenda.common.saveFailed"));
        toast.success(t("agenda.blocks.created"));
        if (res.data?.conflicts) toast.warning(t("agenda.blocks.conflicts", { count: res.data.conflicts }), { duration: 10000 });
        setForm(null);
        load(sessionId, showPast);
    };

    const remove = async () => {
        if (!sessionId || !deleting) return;
        const res = await agendaRequest(sessionId, `blocks/${deleting.id}`, { method: "DELETE" });
        setDeleting(null);
        if (!res.ok) return toast.error(res.message || t("agenda.common.saveFailed"));
        toast.success(t("agenda.blocks.deleted"));
        load(sessionId, showPast);
    };

    /** Whole days read as "seg, 13/10 – qua, 15/10"; partial ones show the times. */
    const describe = (block: AgendaBlock) => {
        const startDay = dayIn(block.startsAt, timezone);
        const startTime = timeIn(block.startsAt, timezone);
        const endTime = timeIn(block.endsAt, timezone);
        if (startTime === "00:00" && endTime === "00:00") {
            const lastDay = shiftDay(dayIn(block.endsAt, timezone), -1);
            return lastDay === startDay ? formatDayShort(startDay, locale) : `${formatDayShort(startDay, locale)} – ${formatDayShort(lastDay, locale)}`;
        }
        const endDay = dayIn(block.endsAt, timezone);
        return endDay === startDay
            ? `${formatDayShort(startDay, locale)}, ${startTime}–${endTime}`
            : `${formatDayShort(startDay, locale)} ${startTime} – ${formatDayShort(endDay, locale)} ${endTime}`;
    };

    return (
        <SessionGuard>
            <PageHeader
                title={t("agenda.blocks.title")}
                description={t("agenda.blocks.subtitle")}
                icon={CalendarOff}
                actions={
                    <>
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Switch checked={showPast} onCheckedChange={setShowPast} /> {t("agenda.blocks.showPast")}
                        </label>
                        <Button onClick={openNew} disabled={loading}><Plus /> {t("agenda.blocks.add")}</Button>
                    </>
                }
            />

            {loading ? (
                <Card className="space-y-3 p-4">{[0, 1].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</Card>
            ) : blocks.length === 0 ? (
                <Card>
                    <EmptyState icon={CalendarOff} title={t("agenda.blocks.empty")} description={t("agenda.blocks.emptyHint")} action={<Button onClick={openNew}><Plus /> {t("agenda.blocks.add")}</Button>} />
                </Card>
            ) : (
                <Card className="py-0">
                    <ul className="divide-y divide-border">
                        {blocks.map((block) => {
                            const past = new Date(block.endsAt) < new Date();
                            return (
                                <li key={block.id} className={`flex items-center gap-3 p-4 ${past ? "opacity-60" : ""}`}>
                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/12 text-warning" aria-hidden="true">
                                        {block.professional ? <UserRound className="size-4" /> : <Store className="size-4" />}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium first-letter:uppercase">{describe(block)}</p>
                                        <p className="truncate text-sm text-muted-foreground">
                                            {block.professional?.name ?? t("agenda.blocks.everyone")}
                                            {block.reason ? ` · ${block.reason}` : ""}
                                        </p>
                                    </div>
                                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(block)} aria-label={t("agenda.common.delete")}><Trash2 /></Button>
                                </li>
                            );
                        })}
                    </ul>
                </Card>
            )}

            <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t("agenda.blocks.newTitle")}</DialogTitle>
                        <DialogDescription>{t("agenda.blocks.subtitle")}</DialogDescription>
                    </DialogHeader>
                    {form && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>{t("agenda.blocks.who")}</Label>
                                <Select value={form.who} onValueChange={(v) => update("who", v)}>
                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={EVERYONE}>{t("agenda.blocks.everyone")}</SelectItem>
                                        {professionals.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <label className="flex items-center gap-2 text-sm font-medium">
                                <Switch checked={form.allDay} onCheckedChange={(v) => update("allDay", v)} /> {t("agenda.blocks.allDay")}
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="blk-start">{t("agenda.blocks.startDate")}</Label>
                                    <Input id="blk-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: e.target.value > form.endDate ? e.target.value : form.endDate })} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="blk-end">{t("agenda.blocks.endDate")}</Label>
                                    <Input id="blk-end" type="date" min={form.startDate} value={form.endDate} onChange={(e) => update("endDate", e.target.value)} />
                                </div>
                                {!form.allDay && (
                                    <>
                                        <div className="space-y-2">
                                            <Label htmlFor="blk-stime">{t("agenda.blocks.startTime")}</Label>
                                            <Input id="blk-stime" type="time" value={form.startTime} onChange={(e) => update("startTime", e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="blk-etime">{t("agenda.blocks.endTime")}</Label>
                                            <Input id="blk-etime" type="time" value={form.endTime} onChange={(e) => update("endTime", e.target.value)} />
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="blk-reason">{t("agenda.blocks.reason")}</Label>
                                <Input id="blk-reason" value={form.reason} onChange={(e) => update("reason", e.target.value)} placeholder={t("agenda.blocks.reasonPlaceholder")} maxLength={200} />
                            </div>
                            <p className="flex items-start gap-2 text-xs text-muted-foreground">
                                <Globe className="mt-0.5 size-3.5 shrink-0" /> {t("agenda.assistant.business.timezone")}: {timezone}
                            </p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setForm(null)}>{t("agenda.common.cancel")}</Button>
                        <Button onClick={save} disabled={saving}>{saving ? t("agenda.common.saving") : t("agenda.common.save")}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDelete open={!!deleting} title={t("agenda.blocks.deleteTitle")} description={deleting ? describe(deleting) : undefined} onCancel={() => setDeleting(null)} onConfirm={remove} />
        </SessionGuard>
    );
}
