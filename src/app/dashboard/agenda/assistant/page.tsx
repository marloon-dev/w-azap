"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BellRing, Bot, CheckCircle2, Clock, Loader2, MessageCircle, Save, ShieldAlert, Sparkles, Store, Zap } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/dashboard/session-provider";
import { SessionGuard } from "@/components/dashboard/session-guard";
import { PageHeader } from "@/components/dashboard/page-header";
import { useTranslation } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssistantSimulator } from "@/components/agenda/simulator";
import { agendaRequest } from "@/components/agenda/api";
import type { AgendaSettings } from "@/components/agenda/types";

type Form = Omit<AgendaSettings, "configured" | "canEdit" | "aiLastError" | "aiLastErrorAt">;

const TIMEZONES = [
    "America/Sao_Paulo", "America/Bahia", "America/Fortaleza", "America/Recife", "America/Belem", "America/Manaus",
    "America/Cuiaba", "America/Campo_Grande", "America/Porto_Velho", "America/Boa_Vista", "America/Rio_Branco", "America/Noronha",
    "Europe/Lisbon", "America/New_York", "UTC",
];
const SLOT_STEPS = [5, 10, 15, 20, 30, 60];
const MIN_ADVANCE = [0, 15, 30, 60, 120, 180, 360, 720, 1440];
const MAX_ADVANCE = [7, 14, 30, 60, 90, 180];
const CANCEL_MIN = [0, 1, 2, 3, 6, 12, 24, 48];
const PAUSE_HOURS = [0, 1, 2, 4, 8, 12, 24, 48];
const REMINDER_HOURS = [1, 2, 3, 6, 12, 24, 48];

const AI_PRESETS = {
    omniroute: { name: "OmniRoute", baseUrl: "http://localhost:20128/v1", model: "auto" },
    openai: { name: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
    anthropic: { name: "Anthropic (Claude)", baseUrl: "https://api.anthropic.com/v1", model: "claude-haiku-5-5" },
    openrouter: { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" },
} as const;
type Preset = keyof typeof AI_PRESETS | "custom";

const presetFor = (baseUrl: string): Preset =>
    (Object.keys(AI_PRESETS) as (keyof typeof AI_PRESETS)[]).find((key) => AI_PRESETS[key].baseUrl === baseUrl.replace(/\/+$/, "")) ?? "custom";

const FORM_KEYS = [
    "enabled", "businessName", "businessInfo", "timezone", "slotStep", "minAdvanceMinutes", "maxAdvanceDays", "cancelMinHours",
    "triggerMode", "triggerKeyword", "humanPauseHours", "reminderEnabled", "reminderHours", "notifyProfessional",
    "aiEnabled", "aiBaseUrl", "aiApiKey", "aiModel", "aiInstructions",
] as const satisfies readonly (keyof Form)[];

function toForm(s: AgendaSettings): Form {
    return Object.fromEntries(FORM_KEYS.map((key) => [key, s[key]])) as Form;
}

/** Labeled switch row used by every card */
function ToggleRow({ id, label, description, checked, onChange }: { id: string; label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
                <Label htmlFor={id}>{label}</Label>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <Switch id={id} checked={checked} onCheckedChange={onChange} />
        </div>
    );
}

function NumberSelect({ id, value, options, label, onChange }: { id: string; value: number; options: number[]; label: (n: number) => string; onChange: (n: number) => void }) {
    const all = options.includes(value) ? options : [...options, value].sort((a, b) => a - b);
    return (
        <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
            <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{all.map((n) => <SelectItem key={n} value={String(n)}>{label(n)}</SelectItem>)}</SelectContent>
        </Select>
    );
}

export default function AgendaAssistantPage() {
    const { sessionId } = useSession();
    const { t } = useTranslation();
    const [saved, setSaved] = useState<AgendaSettings | null>(null);
    const [form, setForm] = useState<Form | null>(null);
    const [preset, setPreset] = useState<Preset>("omniroute");
    const [loadedFor, setLoadedFor] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

    const apply = useCallback((data: AgendaSettings) => {
        setSaved(data);
        setForm(toForm(data));
        setPreset(data.aiBaseUrl ? presetFor(data.aiBaseUrl) : "omniroute");
    }, []);

    useEffect(() => {
        if (!sessionId) return;
        agendaRequest<AgendaSettings>(sessionId, "config").then((res) => {
            if (res.ok && res.data) apply(res.data);
            else toast.error(res.message || t("agenda.common.loadFailed"));
            setLoadedFor(sessionId);
        });
    }, [sessionId, apply, t]);

    const dirty = useMemo(() => !!saved && !!form && JSON.stringify(toForm(saved)) !== JSON.stringify(form), [saved, form]);
    const loading = loadedFor !== sessionId || !form;
    const canEdit = saved?.canEdit ?? false;
    const update = <K extends keyof Form>(key: K, value: Form[K]) => setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

    const choosePreset = (value: Preset) => {
        setPreset(value);
        setTestResult(null);
        if (value !== "custom") setForm((prev) => (prev ? { ...prev, aiBaseUrl: AI_PRESETS[value].baseUrl, aiModel: AI_PRESETS[value].model } : prev));
    };

    const save = async () => {
        if (!sessionId || !form) return;
        // Turning on the AI for the first time: fill in the preset so the server gets an address and a model
        const body = form.aiEnabled && !form.aiBaseUrl && preset !== "custom"
            ? { ...form, aiBaseUrl: AI_PRESETS[preset].baseUrl, aiModel: form.aiModel || AI_PRESETS[preset].model }
            : form;
        setSaving(true);
        const res = await agendaRequest<AgendaSettings>(sessionId, "config", { method: "POST", body });
        setSaving(false);
        if (!res.ok || !res.data) return toast.error(res.message || t("agenda.common.saveFailed"));
        apply(res.data);
        toast.success(t("agenda.assistant.saved"));
    };

    const testAi = async () => {
        if (!sessionId || !form) return;
        setTesting(true);
        setTestResult(null);
        const res = await agendaRequest<{ reply: string; ms: number }>(sessionId, "config/test-ai", {
            method: "POST",
            body: { aiBaseUrl: form.aiBaseUrl, aiApiKey: form.aiApiKey, aiModel: form.aiModel },
        });
        setTesting(false);
        setTestResult(res.ok && res.data ? { ok: true, text: t("agenda.assistant.ai.testOk", { ms: res.data.ms, reply: res.data.reply }) } : { ok: false, text: res.message || t("agenda.common.saveFailed") });
    };

    return (
        <SessionGuard>
            <PageHeader
                title={t("agenda.assistant.title")}
                description={t("agenda.assistant.subtitle")}
                icon={Sparkles}
                actions={
                    <>
                        {saved && (
                            <Badge variant={saved.enabled ? "success" : "muted"}>
                                {saved.enabled ? <CheckCircle2 /> : <AlertCircle />} {saved.enabled ? t("agenda.assistant.statusOn") : t("agenda.assistant.statusOff")}
                            </Badge>
                        )}
                        {canEdit && (
                            <Button onClick={save} disabled={saving || loading || !dirty}>
                                {saving ? <Loader2 className="animate-spin" /> : <Save />} {t("agenda.common.save")}
                            </Button>
                        )}
                    </>
                }
            />

            {loading || !form || !sessionId ? (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                    <div className="space-y-6">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56 w-full rounded-xl" />)}</div>
                    <Skeleton className="h-[640px] w-full rounded-xl" />
                </div>
            ) : (
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                    <fieldset disabled={!canEdit} className="min-w-0 space-y-6">
                        {!canEdit && (
                            <p className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
                                <ShieldAlert className="size-4 shrink-0" /> {t("agenda.assistant.ownerOnly")}
                            </p>
                        )}

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Store className="size-4" /> {t("agenda.assistant.business.title")}</CardTitle>
                                <CardDescription>{t("agenda.assistant.business.desc")}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <ToggleRow id="ag-enabled" label={t("agenda.assistant.business.enabled")} description={t("agenda.assistant.business.enabledDesc")} checked={form.enabled} onChange={(v) => update("enabled", v)} />
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="ag-name">{t("agenda.assistant.business.name")}</Label>
                                        <Input id="ag-name" value={form.businessName} onChange={(e) => update("businessName", e.target.value)} placeholder={t("agenda.assistant.business.namePlaceholder")} maxLength={120} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="ag-tz">{t("agenda.assistant.business.timezone")}</Label>
                                        <Select value={form.timezone} onValueChange={(v) => update("timezone", v)}>
                                            <SelectTrigger id="ag-tz" className="w-full"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {(TIMEZONES.includes(form.timezone) ? TIMEZONES : [form.timezone, ...TIMEZONES]).map((tz) => <SelectItem key={tz} value={tz}>{tz.replace(/_/g, " ")}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ag-info">{t("agenda.assistant.business.info")}</Label>
                                    <Textarea id="ag-info" value={form.businessInfo} onChange={(e) => update("businessInfo", e.target.value)} rows={4} maxLength={4000} placeholder={"Rua das Flores, 123 — Centro\nPix, cartão e dinheiro\nTolerância de 10 min de atraso"} />
                                    <p className="text-xs text-muted-foreground">{t("agenda.assistant.business.infoHint")}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Clock className="size-4" /> {t("agenda.assistant.rules.title")}</CardTitle>
                                <CardDescription>{t("agenda.assistant.rules.desc")}</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-5 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="ag-step">{t("agenda.assistant.rules.slotStep")}</Label>
                                    <NumberSelect id="ag-step" value={form.slotStep} options={SLOT_STEPS} onChange={(n) => update("slotStep", n)} label={(n) => t("agenda.assistant.rules.minutesOption", { n })} />
                                    <p className="text-xs text-muted-foreground">{t("agenda.assistant.rules.slotStepHint")}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ag-min">{t("agenda.assistant.rules.minAdvance")}</Label>
                                    <NumberSelect
                                        id="ag-min"
                                        value={form.minAdvanceMinutes}
                                        options={MIN_ADVANCE}
                                        onChange={(n) => update("minAdvanceMinutes", n)}
                                        label={(n) => (n === 0 ? t("agenda.assistant.rules.noNotice") : n < 60 ? t("agenda.assistant.rules.minutesOption", { n }) : t("agenda.assistant.rules.hoursOption", { n: n / 60 }))}
                                    />
                                    <p className="text-xs text-muted-foreground">{t("agenda.assistant.rules.minAdvanceHint")}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ag-max">{t("agenda.assistant.rules.maxAdvance")}</Label>
                                    <NumberSelect id="ag-max" value={form.maxAdvanceDays} options={MAX_ADVANCE} onChange={(n) => update("maxAdvanceDays", n)} label={(n) => t("agenda.assistant.rules.daysOption", { n })} />
                                    <p className="text-xs text-muted-foreground">{t("agenda.assistant.rules.maxAdvanceHint")}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ag-cancel">{t("agenda.assistant.rules.cancelMin")}</Label>
                                    <NumberSelect
                                        id="ag-cancel"
                                        value={form.cancelMinHours}
                                        options={CANCEL_MIN}
                                        onChange={(n) => update("cancelMinHours", n)}
                                        label={(n) => (n === 0 ? t("agenda.assistant.rules.noNotice") : t("agenda.assistant.rules.hoursOption", { n }))}
                                    />
                                    <p className="text-xs text-muted-foreground">{t("agenda.assistant.rules.cancelMinHint")}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><MessageCircle className="size-4" /> {t("agenda.assistant.trigger.title")}</CardTitle>
                                <CardDescription>{t("agenda.assistant.trigger.desc")}</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-5 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="ag-mode">{t("agenda.assistant.trigger.mode")}</Label>
                                    <Select value={form.triggerMode} onValueChange={(v) => update("triggerMode", v as Form["triggerMode"])}>
                                        <SelectTrigger id="ag-mode" className="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">{t("agenda.assistant.trigger.modeAll")}</SelectItem>
                                            <SelectItem value="KEYWORD">{t("agenda.assistant.trigger.modeKeyword")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {form.triggerMode === "KEYWORD" && (
                                    <div className="space-y-2">
                                        <Label htmlFor="ag-keyword">{t("agenda.assistant.trigger.keyword")}</Label>
                                        <Input id="ag-keyword" value={form.triggerKeyword} onChange={(e) => update("triggerKeyword", e.target.value)} maxLength={40} />
                                        <p className="text-xs text-muted-foreground">{t("agenda.assistant.trigger.keywordHint")}</p>
                                    </div>
                                )}
                                <div className="space-y-2 sm:col-span-2">
                                    <Label htmlFor="ag-pause">{t("agenda.assistant.trigger.humanPause")}</Label>
                                    <div className="sm:max-w-[calc(50%-0.625rem)]">
                                        <NumberSelect
                                            id="ag-pause"
                                            value={form.humanPauseHours}
                                            options={PAUSE_HOURS}
                                            onChange={(n) => update("humanPauseHours", n)}
                                            label={(n) => (n === 0 ? t("agenda.assistant.trigger.never") : t("agenda.assistant.rules.hoursOption", { n }))}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">{t("agenda.assistant.trigger.humanPauseHint")}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><BellRing className="size-4" /> {t("agenda.assistant.notices.title")}</CardTitle>
                                <CardDescription>{t("agenda.assistant.notices.desc")}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <ToggleRow id="ag-reminder" label={t("agenda.assistant.notices.reminder")} description={t("agenda.assistant.notices.reminderDesc")} checked={form.reminderEnabled} onChange={(v) => update("reminderEnabled", v)} />
                                {form.reminderEnabled && (
                                    <div className="space-y-2 sm:max-w-xs">
                                        <Label htmlFor="ag-reminder-hours">{t("agenda.assistant.notices.reminderHours")}</Label>
                                        <NumberSelect id="ag-reminder-hours" value={form.reminderHours} options={REMINDER_HOURS} onChange={(n) => update("reminderHours", n)} label={(n) => t("agenda.assistant.notices.reminderOption", { n })} />
                                    </div>
                                )}
                                <ToggleRow id="ag-notify" label={t("agenda.assistant.notices.notifyProfessional")} description={t("agenda.assistant.notices.notifyProfessionalDesc")} checked={form.notifyProfessional} onChange={(v) => update("notifyProfessional", v)} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Bot className="size-4" /> {t("agenda.assistant.ai.title")}</CardTitle>
                                <CardDescription>{t("agenda.assistant.ai.desc")}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <ToggleRow id="ag-ai" label={t("agenda.assistant.ai.enabled")} description={t("agenda.assistant.ai.enabledDesc")} checked={form.aiEnabled} onChange={(v) => update("aiEnabled", v)} />
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="ag-preset">{t("agenda.assistant.ai.provider")}</Label>
                                        <Select value={preset} onValueChange={(v) => choosePreset(v as Preset)}>
                                            <SelectTrigger id="ag-preset" className="w-full"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {(Object.keys(AI_PRESETS) as (keyof typeof AI_PRESETS)[]).map((key) => <SelectItem key={key} value={key}>{AI_PRESETS[key].name}</SelectItem>)}
                                                <SelectItem value="custom">{t("agenda.assistant.ai.presetCustom")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="ag-model">{t("agenda.assistant.ai.model")}</Label>
                                        <Input id="ag-model" value={form.aiModel} onChange={(e) => update("aiModel", e.target.value)} placeholder={preset !== "custom" ? AI_PRESETS[preset].model : "gpt-4o-mini"} maxLength={120} />
                                        <p className="text-xs text-muted-foreground">{t("agenda.assistant.ai.modelHint")}</p>
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label htmlFor="ag-url">{t("agenda.assistant.ai.baseUrl")}</Label>
                                        <Input id="ag-url" value={form.aiBaseUrl} onChange={(e) => { update("aiBaseUrl", e.target.value); setPreset(presetFor(e.target.value)); }} placeholder="http://localhost:20128/v1" maxLength={500} />
                                        <p className="text-xs text-muted-foreground">{preset === "omniroute" ? t("agenda.assistant.ai.omnirouteHint") : t("agenda.assistant.ai.baseUrlHint")}</p>
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label htmlFor="ag-key">{t("agenda.assistant.ai.apiKey")}</Label>
                                        <Input id="ag-key" type="password" autoComplete="off" value={form.aiApiKey} onChange={(e) => update("aiApiKey", e.target.value)} maxLength={500} />
                                        {saved?.aiApiKey && form.aiApiKey === saved.aiApiKey && <p className="text-xs text-muted-foreground">{t("agenda.assistant.ai.apiKeyKeep")}</p>}
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label htmlFor="ag-instructions">{t("agenda.assistant.ai.instructions")}</Label>
                                        <Textarea id="ag-instructions" value={form.aiInstructions} onChange={(e) => update("aiInstructions", e.target.value)} rows={3} maxLength={4000} />
                                        <p className="text-xs text-muted-foreground">{t("agenda.assistant.ai.instructionsHint")}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <Button type="button" variant="outline" onClick={testAi} disabled={testing || !form.aiBaseUrl || !form.aiModel}>
                                        {testing ? <Loader2 className="animate-spin" /> : <Zap />} {t("agenda.assistant.ai.test")}
                                    </Button>
                                    {testResult && (
                                        <p role="status" className={`flex items-start gap-1.5 text-sm ${testResult.ok ? "text-success" : "text-destructive"}`}>
                                            {testResult.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />} {testResult.text}
                                        </p>
                                    )}
                                </div>
                                {saved?.aiLastError && (
                                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                        <strong>{t("agenda.assistant.ai.lastError")}:</strong> {saved.aiLastError}
                                        {saved.aiLastErrorAt ? ` (${new Date(saved.aiLastErrorAt).toLocaleString()})` : ""}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </fieldset>

                    <div className="lg:sticky lg:top-6">
                        <AssistantSimulator sessionId={sessionId} dirty={dirty} />
                    </div>
                </div>
            )}
        </SessionGuard>
    );
}
