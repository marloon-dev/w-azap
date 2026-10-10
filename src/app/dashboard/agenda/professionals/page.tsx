"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Pencil, Phone, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/dashboard/session-provider";
import { SessionGuard } from "@/components/dashboard/session-guard";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { useTranslation } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDelete } from "@/components/agenda/confirm-delete";
import { DEFAULT_HOURS, HoursEditor, summarizeHours } from "@/components/agenda/hours-editor";
import { agendaRequest, formatPhone } from "@/components/agenda/api";
import type { AgendaProfessional, AgendaService, WorkingHour } from "@/components/agenda/types";

interface FormState {
    id: string | null;
    name: string;
    phone: string;
    active: boolean;
    sortOrder: number;
    serviceIds: string[];
    hours: WorkingHour[];
}

function initials(name: string) {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

const fetchData = (id: string) =>
    Promise.all([agendaRequest<AgendaProfessional[]>(id, "professionals"), agendaRequest<AgendaService[]>(id, "services")]);

export default function AgendaProfessionalsPage() {
    const { sessionId } = useSession();
    const { t, locale } = useTranslation();
    const [professionals, setProfessionals] = useState<AgendaProfessional[]>([]);
    const [services, setServices] = useState<AgendaService[]>([]);
    const [loadedFor, setLoadedFor] = useState<string | null>(null);
    const [form, setForm] = useState<FormState | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<AgendaProfessional | null>(null);

    const apply = useCallback(([p, s]: Awaited<ReturnType<typeof fetchData>>, id: string) => {
        if (!p.ok || !s.ok) toast.error(p.message || s.message || t("agenda.common.loadFailed"));
        setProfessionals(p.data ?? []);
        setServices(s.data ?? []);
        setLoadedFor(id);
    }, [t]);
    const load = (id: string) => fetchData(id).then((data) => apply(data, id));

    useEffect(() => {
        if (sessionId) fetchData(sessionId).then((data) => apply(data, sessionId));
    }, [sessionId, apply]);

    const loading = loadedFor !== sessionId;
    const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    const serviceName = (id: string) => services.find((s) => s.id === id)?.name;

    const openNew = () =>
        setForm({ id: null, name: "", phone: "", active: true, sortOrder: professionals.length, serviceIds: services.filter((s) => s.active).map((s) => s.id), hours: DEFAULT_HOURS });

    const openEdit = (p: AgendaProfessional) =>
        setForm({ id: p.id, name: p.name, phone: p.phone ?? "", active: p.active, sortOrder: p.sortOrder, serviceIds: p.serviceIds, hours: p.hours });

    const payload = (f: FormState) => ({ name: f.name, phone: f.phone || null, active: f.active, sortOrder: f.sortOrder, serviceIds: f.serviceIds, hours: f.hours });

    const save = async () => {
        if (!sessionId || !form) return;
        setSaving(true);
        const res = form.id
            ? await agendaRequest(sessionId, `professionals/${form.id}`, { method: "PUT", body: payload(form) })
            : await agendaRequest(sessionId, "professionals", { method: "POST", body: payload(form) });
        setSaving(false);
        if (!res.ok) return toast.error(res.message || t("agenda.common.saveFailed"));
        toast.success(t("agenda.professionals.saved"));
        setForm(null);
        load(sessionId);
    };

    const toggleActive = async (p: AgendaProfessional, active: boolean) => {
        if (!sessionId) return;
        setProfessionals((prev) => prev.map((it) => (it.id === p.id ? { ...it, active } : it)));
        const res = await agendaRequest(sessionId, `professionals/${p.id}`, { method: "PUT", body: payload({ ...p, phone: p.phone ?? "", id: p.id, active }) });
        if (!res.ok) {
            toast.error(res.message || t("agenda.common.saveFailed"));
            load(sessionId);
        }
    };

    const remove = async () => {
        if (!sessionId || !deleting) return;
        const res = await agendaRequest(sessionId, `professionals/${deleting.id}`, { method: "DELETE" });
        setDeleting(null);
        if (!res.ok) return toast.error(res.message || t("agenda.common.saveFailed"));
        toast.success(t("agenda.professionals.deleted"));
        load(sessionId);
    };

    return (
        <SessionGuard>
            <PageHeader
                title={t("agenda.professionals.title")}
                description={t("agenda.professionals.subtitle")}
                icon={UserRound}
                actions={<Button onClick={openNew} disabled={loading}><Plus /> {t("agenda.professionals.add")}</Button>}
            />

            {loading ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 w-full rounded-xl" />)}</div>
            ) : professionals.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={UserRound}
                        title={t("agenda.professionals.empty")}
                        description={t("agenda.professionals.emptyHint")}
                        action={<Button onClick={openNew}><Plus /> {t("agenda.professionals.add")}</Button>}
                    />
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {professionals.map((p) => {
                        const summary = summarizeHours(p.hours, locale);
                        return (
                            <Card key={p.id} className={p.active ? "" : "opacity-70"}>
                                <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary" aria-hidden="true">
                                        {initials(p.name)}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <CardTitle className="truncate text-base">{p.name}</CardTitle>
                                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                            <Phone className="size-3" /> {p.phone ? formatPhone(p.phone) : "—"}
                                        </p>
                                    </div>
                                    <Switch checked={p.active} onCheckedChange={(v) => toggleActive(p, v)} aria-label={t("agenda.common.active")} />
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                                        <Clock className="mt-0.5 size-3.5 shrink-0" />
                                        <span>{summary || t("agenda.professionals.noHours")}</span>
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {p.serviceIds.map((id) => serviceName(id)).filter(Boolean).map((name) => (
                                            <Badge key={name} variant="secondary">{name}</Badge>
                                        ))}
                                    </div>
                                    <div className="flex justify-end gap-1 pt-1">
                                        <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil /> {t("agenda.common.edit")}</Button>
                                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(p)} aria-label={t("agenda.common.delete")}><Trash2 /></Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
                <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{form?.id ? t("agenda.professionals.editTitle") : t("agenda.professionals.newTitle")}</DialogTitle>
                        <DialogDescription>{t("agenda.professionals.subtitle")}</DialogDescription>
                    </DialogHeader>
                    {form && (
                        <div className="space-y-5">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="pro-name">{t("agenda.professionals.name")}</Label>
                                    <Input id="pro-name" value={form.name} onChange={(e) => update("name", e.target.value)} maxLength={120} autoFocus />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="pro-phone">{t("agenda.professionals.phone")}</Label>
                                    <Input id="pro-phone" inputMode="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="55 11 98765-4321" />
                                </div>
                            </div>
                            <p className="-mt-2 text-xs text-muted-foreground">{t("agenda.professionals.phoneHint")}</p>

                            <fieldset className="space-y-2">
                                <legend className="text-sm font-medium">{t("agenda.professionals.services")}</legend>
                                {services.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">{t("agenda.professionals.noServices")}</p>
                                ) : (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {services.map((s) => (
                                            <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                                                <Checkbox
                                                    checked={form.serviceIds.includes(s.id)}
                                                    onCheckedChange={(checked) => update("serviceIds", checked ? [...form.serviceIds, s.id] : form.serviceIds.filter((id) => id !== s.id))}
                                                />
                                                <span className={s.active ? "" : "text-muted-foreground"}>{s.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </fieldset>

                            <fieldset className="space-y-2">
                                <legend className="text-sm font-medium">{t("agenda.professionals.hours")}</legend>
                                <HoursEditor value={form.hours} onChange={(hours) => update("hours", hours)} />
                            </fieldset>

                            <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
                                <div>
                                    <Label htmlFor="pro-active">{t("agenda.common.active")}</Label>
                                    <p className="text-xs text-muted-foreground">{t("agenda.professionals.activeDesc")}</p>
                                </div>
                                <Switch id="pro-active" checked={form.active} onCheckedChange={(v) => update("active", v)} />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setForm(null)}>{t("agenda.common.cancel")}</Button>
                        <Button onClick={save} disabled={saving || !form?.name.trim()}>{saving ? t("agenda.common.saving") : t("agenda.common.save")}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDelete
                open={!!deleting}
                title={t("agenda.professionals.deleteTitle", { name: deleting?.name ?? "" })}
                description={t("agenda.professionals.deleteDesc")}
                onCancel={() => setDeleting(null)}
                onConfirm={remove}
            />
        </SessionGuard>
    );
}
