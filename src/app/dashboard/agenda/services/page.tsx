"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Pencil, Plus, Scissors, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/dashboard/session-provider";
import { SessionGuard } from "@/components/dashboard/session-guard";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { useTranslation } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDelete } from "@/components/agenda/confirm-delete";
import { agendaRequest, formatDuration, formatMoney, parseMoney } from "@/components/agenda/api";
import type { AgendaProfessional, AgendaService } from "@/components/agenda/types";
import { cn } from "@/lib/utils";

interface FormState {
    id: string | null;
    name: string;
    description: string;
    durationMinutes: string;
    price: string;
    active: boolean;
    professionalIds: string[];
}

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

const emptyForm = (professionals: AgendaProfessional[]): FormState => ({
    id: null,
    name: "",
    description: "",
    durationMinutes: "30",
    price: "",
    active: true,
    // A new service is usually done by everyone; untick who doesn't
    professionalIds: professionals.filter((p) => p.active).map((p) => p.id),
});

const fetchData = (id: string) =>
    Promise.all([agendaRequest<AgendaService[]>(id, "services"), agendaRequest<AgendaProfessional[]>(id, "professionals")]);

export default function AgendaServicesPage() {
    const { sessionId } = useSession();
    const { t, locale } = useTranslation();
    const [services, setServices] = useState<AgendaService[]>([]);
    const [professionals, setProfessionals] = useState<AgendaProfessional[]>([]);
    const [loadedFor, setLoadedFor] = useState<string | null>(null);
    const [form, setForm] = useState<FormState | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<AgendaService | null>(null);

    const apply = useCallback(([s, p]: Awaited<ReturnType<typeof fetchData>>, id: string) => {
        if (!s.ok || !p.ok) toast.error(s.message || p.message || t("agenda.common.loadFailed"));
        setServices(s.data ?? []);
        setProfessionals(p.data ?? []);
        setLoadedFor(id);
    }, [t]);
    const load = (id: string) => fetchData(id).then((data) => apply(data, id));

    useEffect(() => {
        if (sessionId) fetchData(sessionId).then((data) => apply(data, sessionId));
    }, [sessionId, apply]);

    const loading = loadedFor !== sessionId;
    const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

    const openEdit = (service: AgendaService) =>
        setForm({
            id: service.id,
            name: service.name,
            description: service.description ?? "",
            durationMinutes: String(service.durationMinutes),
            price: service.priceCents !== null ? (service.priceCents / 100).toFixed(2).replace(".", ",") : "",
            active: service.active,
            professionalIds: service.professionalIds,
        });

    const save = async () => {
        if (!sessionId || !form) return;
        const priceCents = parseMoney(form.price);
        if (Number.isNaN(priceCents)) return toast.error(`${t("agenda.services.price")}: ${form.price}`);
        setSaving(true);
        const body = {
            name: form.name,
            description: form.description || null,
            durationMinutes: Number(form.durationMinutes),
            priceCents,
            active: form.active,
            professionalIds: form.professionalIds,
        };
        const res = form.id
            ? await agendaRequest(sessionId, `services/${form.id}`, { method: "PATCH", body })
            : await agendaRequest(sessionId, "services", { method: "POST", body });
        setSaving(false);
        if (!res.ok) return toast.error(res.message || t("agenda.common.saveFailed"));
        toast.success(t("agenda.services.saved"));
        setForm(null);
        load(sessionId);
    };

    const toggleActive = async (service: AgendaService, active: boolean) => {
        if (!sessionId) return;
        setServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, active } : s)));
        const res = await agendaRequest(sessionId, `services/${service.id}`, { method: "PATCH", body: { active } });
        if (!res.ok) {
            toast.error(res.message || t("agenda.common.saveFailed"));
            load(sessionId);
        }
    };

    const remove = async () => {
        if (!sessionId || !deleting) return;
        const res = await agendaRequest(sessionId, `services/${deleting.id}`, { method: "DELETE" });
        setDeleting(null);
        if (!res.ok) return toast.error(res.message || t("agenda.common.saveFailed"));
        toast.success(t("agenda.services.deleted"));
        load(sessionId);
    };

    return (
        <SessionGuard>
            <PageHeader
                title={t("agenda.services.title")}
                description={t("agenda.services.subtitle")}
                icon={Scissors}
                actions={
                    <Button onClick={() => setForm(emptyForm(professionals))} disabled={loading}>
                        <Plus /> {t("agenda.services.add")}
                    </Button>
                }
            />

            {loading ? (
                <Card><CardContent className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</CardContent></Card>
            ) : services.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={Scissors}
                        title={t("agenda.services.empty")}
                        description={t("agenda.services.emptyHint")}
                        action={<Button onClick={() => setForm(emptyForm(professionals))}><Plus /> {t("agenda.services.add")}</Button>}
                    />
                </Card>
            ) : (
                <Card className="py-0">
                    <ul className="divide-y divide-border">
                        {services.map((service) => {
                            const price = formatMoney(service.priceCents, locale);
                            return (
                                <li key={service.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className={service.active ? "font-medium" : "font-medium text-muted-foreground line-through"}>{service.name}</p>
                                            {!service.active && <Badge variant="muted">{t("agenda.common.inactive")}</Badge>}
                                        </div>
                                        {service.description && <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{service.description}</p>}
                                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                            <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {formatDuration(service.durationMinutes)}</span>
                                            <span className="font-medium text-foreground">{price ?? t("agenda.common.onRequest")}</span>
                                            <span className={cn("inline-flex items-center gap-1", service.professionalIds.length === 0 && "text-warning")} title={t("agenda.services.professionals")}>
                                                <Users className="size-3.5" /> {service.professionalIds.length === 0 ? t("agenda.services.nobody") : service.professionalIds.length}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Switch checked={service.active} onCheckedChange={(v) => toggleActive(service, v)} aria-label={t("agenda.common.active")} />
                                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(service)} aria-label={t("agenda.common.edit")}><Pencil /></Button>
                                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(service)} aria-label={t("agenda.common.delete")}><Trash2 /></Button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </Card>
            )}

            <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{form?.id ? t("agenda.services.editTitle") : t("agenda.services.newTitle")}</DialogTitle>
                        <DialogDescription>{t("agenda.services.subtitle")}</DialogDescription>
                    </DialogHeader>
                    {form && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="svc-name">{t("agenda.services.name")}</Label>
                                <Input id="svc-name" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder={t("agenda.services.namePlaceholder")} maxLength={120} autoFocus />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="svc-duration">{t("agenda.services.duration")}</Label>
                                    <Input id="svc-duration" type="number" min={5} max={720} step={5} value={form.durationMinutes} onChange={(e) => update("durationMinutes", e.target.value)} />
                                    <div className="flex flex-wrap gap-1">
                                        {DURATION_PRESETS.map((m) => (
                                            <Button key={m} type="button" size="sm" variant={Number(form.durationMinutes) === m ? "secondary" : "ghost"} className="h-7 px-2 text-xs" onClick={() => update("durationMinutes", String(m))}>
                                                {formatDuration(m)}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="svc-price">{t("agenda.services.price")}</Label>
                                    <Input id="svc-price" inputMode="decimal" value={form.price} onChange={(e) => update("price", e.target.value)} placeholder="45,00" />
                                    <p className="text-xs text-muted-foreground">{t("agenda.services.priceHint")}</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="svc-desc">{t("agenda.services.description")}</Label>
                                <Textarea id="svc-desc" value={form.description} onChange={(e) => update("description", e.target.value)} rows={2} maxLength={1000} />
                                <p className="text-xs text-muted-foreground">{t("agenda.services.descriptionHint")}</p>
                            </div>
                            <fieldset className="space-y-2">
                                <legend className="text-sm font-medium">{t("agenda.services.professionals")}</legend>
                                {professionals.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">{t("agenda.services.noProfessionals")}</p>
                                ) : (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {professionals.map((p) => (
                                            <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                                                <Checkbox
                                                    checked={form.professionalIds.includes(p.id)}
                                                    onCheckedChange={(checked) =>
                                                        update("professionalIds", checked ? [...form.professionalIds, p.id] : form.professionalIds.filter((id) => id !== p.id))
                                                    }
                                                />
                                                <span className={p.active ? "" : "text-muted-foreground"}>{p.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </fieldset>
                            <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
                                <div>
                                    <Label htmlFor="svc-active">{t("agenda.common.active")}</Label>
                                    <p className="text-xs text-muted-foreground">{t("agenda.services.activeDesc")}</p>
                                </div>
                                <Switch id="svc-active" checked={form.active} onCheckedChange={(v) => update("active", v)} />
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
                title={t("agenda.services.deleteTitle", { name: deleting?.name ?? "" })}
                description={t("agenda.services.deleteDesc")}
                onCancel={() => setDeleting(null)}
                onConfirm={remove}
            />
        </SessionGuard>
    );
}
