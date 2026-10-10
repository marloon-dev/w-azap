"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { agendaRequest, dayIn, formatDuration } from "./api";
import type { AgendaAppointment, AgendaProfessional, AgendaService, AgendaSlot } from "./types";

interface Props {
    sessionId: string;
    timezone: string;
    services: AgendaService[];
    professionals: AgendaProfessional[];
    /** Day preselected in the date field */
    day: string;
    /** Set to move an existing appointment; otherwise a new one is created */
    reschedule: AgendaAppointment | null;
    open: boolean;
    onClose: () => void;
    onDone: () => void;
}

/** New appointment or reschedule, picking from the free times of the chosen day. */
export function AppointmentDialog({ sessionId, timezone, services, professionals, day, reschedule, open, onClose, onDone }: Props) {
    const { t } = useTranslation();
    const [serviceId, setServiceId] = useState(reschedule?.serviceId ?? "");
    const [professionalId, setProfessionalId] = useState(reschedule?.professionalId ?? "");
    const [date, setDate] = useState(reschedule ? dayIn(reschedule.startsAt, timezone) : day);
    const [start, setStart] = useState<string | null>(null);
    const [phone, setPhone] = useState("");
    const [name, setName] = useState("");
    const [notes, setNotes] = useState("");
    const [notifyCustomer, setNotifyCustomer] = useState(true);
    const [saving, setSaving] = useState(false);
    const [slots, setSlots] = useState<{ key: string; list: AgendaSlot[] }>({ key: "", list: [] });

    const service = services.find((s) => s.id === serviceId);
    const eligible = useMemo(
        () => professionals.filter((p) => (p.active || p.id === reschedule?.professionalId) && (!serviceId || p.serviceIds.includes(serviceId))),
        [professionals, serviceId, reschedule],
    );
    const slotKey = serviceId && professionalId && date ? `${serviceId}|${professionalId}|${date}` : "";
    const loadingSlots = !!slotKey && slots.key !== slotKey;

    useEffect(() => {
        if (!open || !slotKey) return;
        const query = new URLSearchParams({ serviceId, professionalId, day: date });
        if (reschedule) query.set("excludeAppointmentId", reschedule.id);
        agendaRequest<{ slots: AgendaSlot[] }>(sessionId, `availability?${query}`).then((res) => {
            setSlots({ key: slotKey, list: res.data?.slots ?? [] });
        });
    }, [open, slotKey, sessionId, serviceId, professionalId, date, reschedule]);

    const chooseService = (id: string) => {
        setServiceId(id);
        setStart(null);
        const stillValid = professionals.find((p) => p.id === professionalId)?.serviceIds.includes(id);
        if (!stillValid) {
            const candidates = professionals.filter((p) => p.active && p.serviceIds.includes(id));
            setProfessionalId(candidates.length === 1 ? candidates[0].id : "");
        }
    };

    const submit = async () => {
        if (!start) return;
        setSaving(true);
        const res = reschedule
            ? await agendaRequest(sessionId, `appointments/${reschedule.id}`, {
                method: "PATCH",
                body: { action: "reschedule", startsAt: start, professionalId, notifyCustomer },
            })
            : await agendaRequest(sessionId, "appointments", {
                method: "POST",
                body: { serviceId, professionalId, startsAt: start, customerPhone: phone, customerName: name || null, notes: notes || null },
            });
        setSaving(false);
        if (!res.ok) {
            toast.error(res.message || t("agenda.common.saveFailed"));
            if (res.code === "SLOT_TAKEN") setSlots({ key: "", list: [] });
            return;
        }
        toast.success(reschedule ? t("agenda.appointments.rescheduled") : t("agenda.appointments.form.created"));
        onDone();
    };

    const ready = !!start && !!serviceId && !!professionalId && (reschedule ? true : phone.replace(/\D/g, "").length >= 8);

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{reschedule ? t("agenda.appointments.form.rescheduleTitle") : t("agenda.appointments.form.title")}</DialogTitle>
                    <DialogDescription>
                        {reschedule ? `${reschedule.customerName || reschedule.customerPhone} · ${reschedule.service.name}` : t("agenda.appointments.subtitle")}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="ap-service">{t("agenda.appointments.form.service")}</Label>
                            <Select value={serviceId} onValueChange={chooseService} disabled={!!reschedule}>
                                <SelectTrigger id="ap-service" className="w-full"><SelectValue placeholder={t("agenda.appointments.form.chooseService")} /></SelectTrigger>
                                <SelectContent>
                                    {services.filter((s) => s.active || s.id === reschedule?.serviceId).map((s) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name} · {formatDuration(s.durationMinutes)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ap-pro">{t("agenda.appointments.form.professional")}</Label>
                            <Select value={professionalId} onValueChange={(v) => { setProfessionalId(v); setStart(null); }} disabled={!serviceId}>
                                <SelectTrigger id="ap-pro" className="w-full"><SelectValue placeholder={t("agenda.appointments.form.chooseProfessional")} /></SelectTrigger>
                                <SelectContent>{eligible.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2 sm:max-w-[calc(50%-0.5rem)]">
                        <Label htmlFor="ap-date">{t("agenda.appointments.form.date")}</Label>
                        <Input id="ap-date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setStart(null); }} />
                    </div>

                    <fieldset className="space-y-2">
                        <legend className="text-sm font-medium">{t("agenda.appointments.form.time")}</legend>
                        {!slotKey ? (
                            <p className="text-sm text-muted-foreground">{t("agenda.appointments.form.chooseFirst")}</p>
                        ) : loadingSlots ? (
                            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> …</p>
                        ) : slots.list.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t("agenda.appointments.form.noSlots")}</p>
                        ) : (
                            <div className="grid max-h-48 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
                                {slots.list.map((slot) => (
                                    <Button
                                        key={slot.start}
                                        type="button"
                                        size="sm"
                                        variant={start === slot.start ? "default" : "outline"}
                                        onClick={() => setStart(slot.start)}
                                        aria-pressed={start === slot.start}
                                    >
                                        {slot.time}
                                    </Button>
                                ))}
                            </div>
                        )}
                        {service && <p className="text-xs text-muted-foreground">{formatDuration(service.durationMinutes)} · {timezone.replace(/_/g, " ")}</p>}
                    </fieldset>

                    {reschedule ? (
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked={notifyCustomer} onCheckedChange={(v) => setNotifyCustomer(v === true)} /> {t("agenda.appointments.notifyCustomer")}
                        </label>
                    ) : (
                        <>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="ap-phone">{t("agenda.appointments.form.customerPhone")}</Label>
                                    <Input id="ap-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="11 98765-4321" />
                                    <p className="text-xs text-muted-foreground">{t("agenda.appointments.form.customerPhoneHint")}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ap-name">{t("agenda.appointments.form.customerName")}</Label>
                                    <Input id="ap-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ap-notes">{t("agenda.appointments.form.notes")}</Label>
                                <Textarea id="ap-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} />
                            </div>
                            <p className="flex items-start gap-2 text-xs text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" /> {t("agenda.appointments.form.panelHint")}</p>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>{t("agenda.common.cancel")}</Button>
                    <Button onClick={submit} disabled={saving || !ready}>
                        {saving && <Loader2 className="animate-spin" />} {reschedule ? t("agenda.appointments.form.submitReschedule") : t("agenda.appointments.form.submit")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
