"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Mail, RefreshCw, Save, Send, Server, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useSession as useSessionProvider } from "@/components/dashboard/session-provider";
import { SessionGuard } from "@/components/dashboard/session-guard";
import { PageHeader } from "@/components/dashboard/page-header";
import { useTranslation } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TranslationKey } from "@/lib/i18n/types";

const MAX_RECIPIENTS = 5;
const CONTEXT_OPTIONS = [0, 3, 5, 10, 20];

type Preset = "gmail" | "outlook" | "yahoo" | "icloud" | "custom";

const PRESETS: Record<Exclude<Preset, "custom">, { name: string; host: string; port: number; secure: boolean }> = {
    gmail: { name: "Gmail", host: "smtp.gmail.com", port: 587, secure: false },
    outlook: { name: "Outlook / Hotmail", host: "smtp-mail.outlook.com", port: 587, secure: false },
    yahoo: { name: "Yahoo", host: "smtp.mail.yahoo.com", port: 465, secure: true },
    icloud: { name: "iCloud", host: "smtp.mail.me.com", port: 587, secure: false },
};

interface FormState {
    enabled: boolean;
    recipients: string;
    includeOutgoing: boolean;
    attachMedia: boolean;
    contextMessages: number;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPass: string;
    fromAddress: string;
}

/** Response of GET/POST /api/sessions/{id}/email-forward */
interface EmailForwardData extends Omit<FormState, "smtpUser" | "smtpPass" | "fromAddress"> {
    configured: boolean;
    smtpUser: string | null;
    smtpPass: string | null;
    fromAddress: string | null;
    sentCount: number;
    lastSentAt: string | null;
    lastError: string | null;
    lastErrorAt: string | null;
}

interface ApiError {
    code?: string;
    message?: string;
}

interface Stats {
    sentCount: number;
    lastSentAt: string | null;
    lastError: string | null;
    lastErrorAt: string | null;
}

const EMPTY_FORM: FormState = {
    enabled: false,
    recipients: "",
    includeOutgoing: false,
    attachMedia: true,
    contextMessages: 5,
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: "",
    smtpPass: "",
    fromAddress: "",
};

function presetFor(host: string): Preset {
    const match = (Object.keys(PRESETS) as Exclude<Preset, "custom">[]).find((key) => PRESETS[key].host === host);
    return match ?? "custom";
}

export default function EmailForwardPage() {
    const { sessionId } = useSessionProvider();
    const { t, locale } = useTranslation();

    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [stats, setStats] = useState<Stats | null>(null);
    const [preset, setPreset] = useState<Preset>("gmail");
    // Session whose config is on screen; anything else means "loading" (no setState inside the effect)
    const [loadedFor, setLoadedFor] = useState<string | null>(null);
    const [forbidden, setForbidden] = useState(false);
    const loading = loadedFor !== sessionId;
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

    const applyData = (data: EmailForwardData) => {
        setForm({
            enabled: !!data.enabled,
            recipients: data.recipients || "",
            includeOutgoing: !!data.includeOutgoing,
            attachMedia: data.attachMedia ?? true,
            contextMessages: data.contextMessages ?? 5,
            smtpHost: data.smtpHost || "",
            smtpPort: data.smtpPort || 587,
            smtpSecure: !!data.smtpSecure,
            smtpUser: data.smtpUser || "",
            smtpPass: data.smtpPass || "",
            fromAddress: data.fromAddress || "",
        });
        setStats({ sentCount: data.sentCount || 0, lastSentAt: data.lastSentAt, lastError: data.lastError, lastErrorAt: data.lastErrorAt });
        setPreset(data.configured ? presetFor(data.smtpHost || "") : "gmail");
        if (!data.configured) {
            setForm((prev) => ({ ...prev, smtpHost: PRESETS.gmail.host, smtpPort: PRESETS.gmail.port, smtpSecure: PRESETS.gmail.secure }));
        }
    };

    useEffect(() => {
        if (!sessionId) return;
        fetch(`/api/sessions/${sessionId}/email-forward`)
            .then(async (res) => {
                setForbidden(res.status === 403);
                if (res.status === 403) return;
                const body = await res.json();
                if (res.ok && body?.data) applyData(body.data);
            })
            .catch(() => toast.error(t("emailForward.loadFailed")))
            .finally(() => setLoadedFor(sessionId));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId]);

    const choosePreset = (value: Preset) => {
        setPreset(value);
        if (value !== "custom") {
            const p = PRESETS[value];
            setForm((prev) => ({ ...prev, smtpHost: p.host, smtpPort: p.port, smtpSecure: p.secure }));
        }
    };

    const chooseSecurity = (value: string) => {
        const secure = value === "tls";
        setForm((prev) => ({
            ...prev,
            smtpSecure: secure,
            // Follow the usual port for each mode unless the user typed a custom one
            smtpPort: prev.smtpPort === 587 || prev.smtpPort === 465 ? (secure ? 465 : 587) : prev.smtpPort,
        }));
    };

    const errorMessage = (body: ApiError | null): string => {
        const code = body?.code;
        const known = ["auth", "connection", "tls", "recipient", "private_host", "unknown"];
        if (code && known.includes(code)) {
            const detail = body?.message ? ` (${body.message})` : "";
            return t(`emailForward.errors.${code}` as TranslationKey) + detail;
        }
        return body?.message || t("emailForward.saveFailed");
    };

    const payload = () => ({ ...form, smtpPort: Number(form.smtpPort) || 587 });

    const handleSave = async () => {
        if (!sessionId) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/sessions/${sessionId}/email-forward`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload()),
            });
            const body = await res.json().catch(() => null);
            if (res.ok && body?.data) {
                applyData(body.data);
                toast.success(t("emailForward.saved"));
            } else {
                toast.error(errorMessage(body));
            }
        } catch {
            toast.error(t("emailForward.saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        if (!sessionId) return;
        setTesting(true);
        try {
            const res = await fetch(`/api/sessions/${sessionId}/email-forward/test`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload()),
            });
            const body = await res.json().catch(() => null);
            if (res.ok) toast.success(t("emailForward.testSent", { to: form.recipients }));
            else toast.error(errorMessage(body), { duration: 10000 });
        } catch {
            toast.error(t("emailForward.errors.unknown"));
        } finally {
            setTesting(false);
        }
    };

    const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString(locale) : t("emailForward.never"));
    const recipientCount = form.recipients.split(/[\s,;]+/).filter(Boolean).length;

    return (
        <SessionGuard>
            <div className="mx-auto w-full max-w-4xl space-y-6">
                <PageHeader icon={Mail} title={t("emailForward.title")} description={t("emailForward.subtitle")} />

                {forbidden ? (
                    <Card className="border-warning/30 bg-warning/10">
                        <CardContent className="flex items-start gap-3">
                            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                            <p className="text-sm text-warning">{t("emailForward.ownerOnly")}</p>
                        </CardContent>
                    </Card>
                ) : loading ? (
                    <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
                        <RefreshCw className="h-4 w-4 animate-spin" /> {t("common.loading")}
                    </div>
                ) : (
                    <>
                        {/* Status */}
                        {stats && (
                            <Card>
                                <CardContent className="grid gap-4 sm:grid-cols-3">
                                    <div>
                                        <p className="text-xs text-muted-foreground">{t("emailForward.status")}</p>
                                        <p className={`mt-1 flex items-center gap-1.5 text-sm font-medium ${form.enabled ? "text-success" : "text-muted-foreground"}`}>
                                            {form.enabled && <CheckCircle2 className="h-4 w-4" />}
                                            {form.enabled ? t("emailForward.statusActive") : t("emailForward.statusInactive")}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">{t("emailForward.sentCount")}</p>
                                        <p className="mt-1 text-sm font-medium tabular-nums">{stats.sentCount}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">{t("emailForward.lastSent")}</p>
                                        <p className="mt-1 text-sm font-medium">{formatDate(stats.lastSentAt)}</p>
                                    </div>
                                    {stats.lastError && (
                                        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 sm:col-span-3">
                                            <p className="text-xs font-medium text-destructive">
                                                {t("emailForward.lastError")} · {formatDate(stats.lastErrorAt)}
                                            </p>
                                            <p className="mt-1 break-words text-sm text-destructive">{stats.lastError}</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Forwarding */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Mail className="h-5 w-5 text-primary" />
                                    {t("emailForward.forwarding")}
                                </CardTitle>
                                <CardDescription>{t("emailForward.forwardingDesc")}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="flex items-start justify-between gap-4">
                                    <Label htmlFor="ef-enabled" className="flex flex-col items-start gap-1">
                                        <span>{t("emailForward.enabled")}</span>
                                        <span className="text-xs font-normal text-muted-foreground">{t("emailForward.enabledDesc")}</span>
                                    </Label>
                                    <Switch id="ef-enabled" checked={form.enabled} onCheckedChange={(c) => update("enabled", c)} />
                                </div>

                                <div className="grid content-start gap-2">
                                    <Label htmlFor="ef-recipients">{t("emailForward.recipients")}</Label>
                                    <Input
                                        id="ef-recipients"
                                        type="text"
                                        inputMode="email"
                                        autoComplete="email"
                                        placeholder="voce@exemplo.com"
                                        value={form.recipients}
                                        onChange={(e) => update("recipients", e.target.value)}
                                        aria-invalid={recipientCount > MAX_RECIPIENTS}
                                    />
                                    <p className="text-xs text-muted-foreground">{t("emailForward.recipientsHint", { max: MAX_RECIPIENTS })}</p>
                                </div>

                                <div className="flex items-start justify-between gap-4 border-t border-border/50 pt-4">
                                    <Label htmlFor="ef-outgoing" className="flex flex-col items-start gap-1">
                                        <span>{t("emailForward.includeOutgoing")}</span>
                                        <span className="text-xs font-normal text-muted-foreground">{t("emailForward.includeOutgoingDesc")}</span>
                                    </Label>
                                    <Switch id="ef-outgoing" checked={form.includeOutgoing} onCheckedChange={(c) => update("includeOutgoing", c)} />
                                </div>

                                <div className="flex items-start justify-between gap-4">
                                    <Label htmlFor="ef-media" className="flex flex-col items-start gap-1">
                                        <span>{t("emailForward.attachMedia")}</span>
                                        <span className="text-xs font-normal text-muted-foreground">{t("emailForward.attachMediaDesc")}</span>
                                    </Label>
                                    <Switch id="ef-media" checked={form.attachMedia} onCheckedChange={(c) => update("attachMedia", c)} />
                                </div>

                                <div className="grid content-start gap-2 sm:max-w-xs">
                                    <Label>{t("emailForward.contextMessages")}</Label>
                                    <Select value={String(form.contextMessages)} onValueChange={(v) => update("contextMessages", Number(v))}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CONTEXT_OPTIONS.map((n) => (
                                                <SelectItem key={n} value={String(n)}>
                                                    {n === 0 ? t("emailForward.contextNone") : n}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">{t("emailForward.contextMessagesDesc")}</p>
                                </div>

                                <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>
                                        {t("emailForward.privacyNote")} {t("emailForward.limitNote")}
                                    </span>
                                </p>
                            </CardContent>
                        </Card>

                        {/* SMTP */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Server className="h-5 w-5 text-primary" />
                                    {t("emailForward.smtp")}
                                </CardTitle>
                                <CardDescription>{t("emailForward.smtpDesc")}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="grid content-start gap-2">
                                        <Label>{t("emailForward.preset")}</Label>
                                        <Select value={preset} onValueChange={(v) => choosePreset(v as Preset)}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(Object.keys(PRESETS) as Exclude<Preset, "custom">[]).map((key) => (
                                                    <SelectItem key={key} value={key}>
                                                        {PRESETS[key].name}
                                                    </SelectItem>
                                                ))}
                                                <SelectItem value="custom">{t("emailForward.presetCustom")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid content-start gap-2">
                                        <Label>{t("emailForward.security")}</Label>
                                        <Select value={form.smtpSecure ? "tls" : "starttls"} onValueChange={chooseSecurity}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="starttls">{t("emailForward.securityStarttls")}</SelectItem>
                                                <SelectItem value="tls">{t("emailForward.securityTls")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {preset === "gmail" && <p className="rounded-md bg-info/10 p-3 text-xs text-info">{t("emailForward.gmailHint")}</p>}
                                {preset === "outlook" && <p className="rounded-md bg-info/10 p-3 text-xs text-info">{t("emailForward.outlookHint")}</p>}

                                <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                                    <div className="grid content-start gap-2">
                                        <Label htmlFor="ef-host">{t("emailForward.host")}</Label>
                                        <Input
                                            id="ef-host"
                                            placeholder="smtp.exemplo.com"
                                            value={form.smtpHost}
                                            onChange={(e) => {
                                                update("smtpHost", e.target.value.trim());
                                                setPreset(presetFor(e.target.value.trim()));
                                            }}
                                        />
                                    </div>
                                    <div className="grid content-start gap-2">
                                        <Label htmlFor="ef-port">{t("emailForward.port")}</Label>
                                        <Input
                                            id="ef-port"
                                            type="number"
                                            min={1}
                                            max={65535}
                                            value={form.smtpPort}
                                            onChange={(e) => update("smtpPort", Number(e.target.value))}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="grid content-start gap-2">
                                        <Label htmlFor="ef-user">{t("emailForward.user")}</Label>
                                        <Input
                                            id="ef-user"
                                            autoComplete="off"
                                            placeholder="voce@gmail.com"
                                            value={form.smtpUser}
                                            onChange={(e) => update("smtpUser", e.target.value)}
                                        />
                                    </div>
                                    <div className="grid content-start gap-2">
                                        <Label htmlFor="ef-pass">{t("emailForward.password")}</Label>
                                        <Input
                                            id="ef-pass"
                                            type="password"
                                            autoComplete="new-password"
                                            value={form.smtpPass}
                                            onFocus={() => form.smtpPass === "••••••••" && update("smtpPass", "")}
                                            onChange={(e) => update("smtpPass", e.target.value)}
                                        />
                                        <p className="text-xs text-muted-foreground">{t("emailForward.passwordKeep")}</p>
                                    </div>
                                </div>

                                <div className="grid content-start gap-2">
                                    <Label htmlFor="ef-from">{t("emailForward.from")}</Label>
                                    <Input
                                        id="ef-from"
                                        type="email"
                                        placeholder={form.smtpUser || "voce@exemplo.com"}
                                        value={form.fromAddress}
                                        onChange={(e) => update("fromAddress", e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">{t("emailForward.fromHint")}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button variant="outline" onClick={handleTest} disabled={testing || saving || !form.recipients || !form.smtpHost}>
                                {testing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                {t("emailForward.sendTest")}
                            </Button>
                            <Button onClick={handleSave} disabled={saving || testing}>
                                {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                {t("emailForward.save")}
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </SessionGuard>
    );
}
