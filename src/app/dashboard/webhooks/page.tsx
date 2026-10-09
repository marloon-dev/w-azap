"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Plus, Copy, RefreshCw, Webhook, Key, Eye, EyeOff, Play, History, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { SessionGuard } from "@/components/dashboard/session-guard";
import WebhookLogDialog from "@/components/dashboard/webhook-log-dialog";

interface WebhookConfig {
    id: string;
    name: string;
    url: string;
    secret?: string;
    sessionId?: string;
    events: string[];
    isActive: boolean;
    createdAt: string;
}

interface WebhookLog {
    id: string;
    webhookId: string;
    event: string;
    status: string;
    requestUrl: string;
    requestHeaders?: any;
    requestBody?: any;
    responseStatusCode?: number;
    responseBody?: string;
    responseTimeMs?: number;
    errorMessage?: string;
    createdAt: string;
}

const AVAILABLE_EVENTS = [
    { id: "message.received", label: "Message Received", description: "When a new message is received" },
    { id: "message.sent", label: "Message Sent", description: "When a message is sent" },
    { id: "message.status", label: "Message Status", description: "When message status changes (delivered, read)" },
    { id: "connection.update", label: "Connection Update", description: "When session connects/disconnects" },
    { id: "group.update", label: "Group Update", description: "When group info changes" },
    { id: "group.participant", label: "Group Member", description: "When participants join, leave, or change roles" },
    { id: "contact.update", label: "Contact Update", description: "When contact info changes" },
    { id: "status.update", label: "Status/Story", description: "When a status is posted or viewed" },
    { id: "message.edited", label: "Message Edited", description: "When a message is edited" },
    { id: "message.deleted", label: "Message Deleted", description: "When a message is revoked/deleted" },
];

import { useSession } from "@/components/dashboard/session-provider";
import { useTranslation } from "@/components/i18n-provider";
import { translateValue } from "@/lib/i18n/translate";

export default function WebhooksPage() {
    const { sessionId, sessions } = useSession();
    const { t, locale } = useTranslation();
    const eventLabel = (id: string) => translateValue(t, "webhooks.eventLabels", id.replace(".", "_"));
    const eventDesc = (id: string) => translateValue(t, "webhooks.eventDescs", id.replace(".", "_"));
    const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
    // Full key exists only right after generation; afterwards the server only returns a hint
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [apiKeyHint, setApiKeyHint] = useState<string | null>(null);
    const [showApiKey, setShowApiKey] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showRegenConfirm, setShowRegenConfirm] = useState(false);

    // New webhook form
    const [showNewForm, setShowNewForm] = useState(false);
    const [newName, setNewName] = useState("");
    const [newUrl, setNewUrl] = useState("");
    const [newSecret, setNewSecret] = useState("");
    const [newEvents, setNewEvents] = useState<string[]>(["message.received", "message.sent"]);

    // Testing state
    const [testingId, setTestingId] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, any>>({});

    // Log viewer state
    const [logDialogId, setLogDialogId] = useState<string | null>(null);
    const [logDialogName, setLogDialogName] = useState("");
    const [logDialogSessionId, setLogDialogSessionId] = useState("");

    useEffect(() => {
        if (sessions.length > 0) {
            fetchWebhooks();
        }
        fetchApiKey();
    }, [sessionId, sessions]);

    const fetchWebhooks = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/webhooks/${sessionId}`);
            if (res.ok) {
                const responseData = await res.json();
                const data = responseData?.data || [];
                const currentSession = sessions.find(s => s.sessionId === sessionId);
                const currentSessionCuid = currentSession?.id;

                const filtered = data.filter((w: WebhookConfig) =>
                    w.sessionId === sessionId ||
                    w.sessionId === currentSessionCuid ||
                    !w.sessionId
                );
                setWebhooks(filtered);
            }
        } catch (error) {
            console.error("Failed to fetch webhooks", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchApiKey = async () => {
        try {
            const res = await fetch("/api/user/api-key");
            if (res.ok) {
                const data = await res.json();
                setApiKeyHint(data?.data?.hint ?? null);
            }
        } catch (error) {
            console.error("Failed to fetch API key", error);
        }
    };

    const generateNewApiKey = async () => {
        try {
            const res = await fetch("/api/user/api-key", { method: "POST" });
            if (res.ok) {
                const data = await res.json();
                setApiKey(data?.data?.apiKey);
                setApiKeyHint(data?.data?.hint ?? null);
                setShowApiKey(true);
                toast.success(t("webhooks.apiKeyGenerated"));
            }
        } catch (error) {
            toast.error(t("webhooks.apiKeyFailed"));
        }
    };

    const handleTestWebhook = async (webhook: WebhookConfig) => {
        setTestingId(webhook.id);
        setTestResults(prev => ({ ...prev, [webhook.id]: { testing: true } }));
        try {
            const targetSessionId = webhook.sessionId || sessionId;
            const res = await fetch(`/api/webhooks/${targetSessionId}/${webhook.id}/test`, { method: "POST" });
            const data = await res.json();
            setTestResults(prev => ({ ...prev, [webhook.id]: data?.data || { success: false, error: t("webhooks.noResponse") } }));
            if (data?.data?.success) {
                toast.success(t("webhooks.testOk"));
            } else {
                toast.error(t("webhooks.testFailedMsg", { error: data?.data?.error || t("webhooks.unknownError") }));
            }
        } catch (error: any) {
            setTestResults(prev => ({ ...prev, [webhook.id]: { success: false, error: error.message } }));
            toast.error(t("webhooks.testFailed"));
        } finally {
            setTestingId(null);
        }
    };

    const openLogDialog = (webhook: WebhookConfig) => {
        const targetSessionId = webhook.sessionId || sessionId || "";
        setLogDialogId(webhook.id);
        setLogDialogName(webhook.name);
        setLogDialogSessionId(targetSessionId);
    };

    const closeLogDialog = () => {
        setLogDialogId(null);
        setLogDialogName("");
        setLogDialogSessionId("");
    };

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editName, setEditName] = useState("");
    const [editUrl, setEditUrl] = useState("");
    const [editSecret, setEditSecret] = useState("");
    const [editEvents, setEditEvents] = useState<string[]>([]);

    const handleEdit = (webhook: WebhookConfig) => {
        setEditingId(webhook.id);
        setEditName(webhook.name);
        setEditUrl(webhook.url);
        setEditSecret(webhook.secret || "");
        setEditEvents(webhook.events);
        setIsEditOpen(true);
    };

    const handleSaveWebhook = async () => {
        if (!newName || !newUrl || newEvents.length === 0) {
            toast.error(t("webhooks.required"));
            return;
        }
        if (!sessionId) {
            toast.error(t("webhooks.noSession"));
            return;
        }
        try {
            const payload: any = { name: newName, url: newUrl, events: newEvents };
            if (newSecret) payload.secret = newSecret;
            const res = await fetch(`/api/webhooks/${sessionId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                toast.success(t("webhooks.created"));
                setShowNewForm(false);
                setNewName("");
                setNewUrl("");
                setNewSecret("");
                setNewEvents(["message.received", "message.sent"]);
                fetchWebhooks();
            } else {
                toast.error(t("webhooks.createFailed"));
            }
        } catch (error) {
            toast.error(t("webhooks.errorOccurred"));
        }
    };

    const handleUpdateWebhook = async () => {
        if (!editName || !editUrl || editEvents.length === 0) {
            toast.error(t("webhooks.required"));
            return;
        }
        if (!sessionId || !editingId) return;
        try {
            const webhook = webhooks.find(w => w.id === editingId);
            const targetSessionId = webhook?.sessionId || sessionId;
            const payload: any = { name: editName, url: editUrl, events: editEvents };
            if (editSecret) payload.secret = editSecret;
            const res = await fetch(`/api/webhooks/${targetSessionId}/${editingId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                toast.success(t("webhooks.updated"));
                setIsEditOpen(false);
                setEditingId(null);
                fetchWebhooks();
            } else {
                toast.error(t("webhooks.updateFailed"));
            }
        } catch (error) {
            toast.error(t("webhooks.errorOccurred"));
        }
    };

    const toggleWebhookActive = async (id: string, isActive: boolean) => {
        try {
            const webhook = webhooks.find(w => w.id === id);
            const targetSessionId = webhook?.sessionId || sessionId;
            await fetch(`/api/webhooks/${targetSessionId}/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive })
            });
            setWebhooks(webhooks.map(w => w.id === id ? { ...w, isActive } : w));
        } catch (error) {
            toast.error(t("webhooks.updateFailed"));
        }
    };

    const toggleEventForWebhook = async (webhookId: string, eventId: string) => {
        const webhook = webhooks.find(w => w.id === webhookId);
        if (!webhook) return;
        const newEvents = webhook.events.includes(eventId)
            ? webhook.events.filter(e => e !== eventId)
            : [...webhook.events, eventId];
        const targetSessionId = webhook.sessionId || sessionId;
        try {
            await fetch(`/api/webhooks/${targetSessionId}/${webhookId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ events: newEvents })
            });
            setWebhooks(webhooks.map(w => w.id === webhookId ? { ...w, events: newEvents } : w));
        } catch (error) {
            toast.error(t("webhooks.eventsUpdateFailed"));
        }
    };

    const [deleteId, setDeleteId] = useState<string | null>(null);

    const deleteWebhook = async (id: string) => {
        setDeleteId(id);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        try {
            const webhook = webhooks.find(w => w.id === deleteId);
            const targetSessionId = webhook?.sessionId || sessionId;
            await fetch(`/api/webhooks/${targetSessionId}/${deleteId}`, { method: "DELETE" });
            setWebhooks(webhooks.filter(w => w.id !== deleteId));
            toast.success(t("webhooks.deleted"));
        } catch (error) {
            toast.error(t("webhooks.deleteFailed"));
        } finally {
            setDeleteId(null);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success(t("webhooks.copied"));
    };

    // Format JSON for display
    const formatJson = (obj: any): string => {
        try {
            return JSON.stringify(obj, null, 2);
        } catch {
            return String(obj);
        }
    };

    // Format timestamp
    const formatTime = (ts: string) => {
        const d = new Date(ts);
        return d.toLocaleString(locale, { timeZone: "Asia/Jakarta" });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold">{t("webhooks.title")}</h1>
            </div>

            {/* API Key Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5" /> {t("webhooks.apiKey")}
                    </CardTitle>
                    <CardDescription>
                        {t("webhooks.apiKeyDesc")}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                        <div className="flex-1 bg-slate-100 rounded-md p-2 sm:p-3 font-mono text-xs sm:text-sm overflow-x-auto">
                            {apiKey ? (
                                showApiKey ? apiKey : "••••••••••••••••••••••••••••••••"
                            ) : apiKeyHint ? (
                                `${apiKeyHint}••••••••••••••••••••••••`
                            ) : (
                                <span className="text-muted-foreground">{t("webhooks.noApiKey")}</span>
                            )}
                        </div>
                        {apiKey && (
                            <>
                                <Button variant="ghost" size="icon" onClick={() => setShowApiKey(!showApiKey)}>
                                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(apiKey)}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                        <Button onClick={() => {
                            if (apiKey || apiKeyHint) setShowRegenConfirm(true);
                            else generateNewApiKey();
                        }}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            {apiKey || apiKeyHint ? t("webhooks.regenerate") : t("webhooks.generate")}
                        </Button>
                    </div>
                    {apiKey && (
                        <p className="text-xs font-medium text-amber-600 mt-2">{t("webhooks.apiKeyOnce")}</p>
                    )}
                    {(apiKey || apiKeyHint) && (
                        <p className="text-xs text-muted-foreground mt-2">
                            {t("webhooks.example")} <code className="bg-slate-100 px-1 py-0.5 rounded">curl -H "X-API-Key: {(apiKey || apiKeyHint || "").slice(0, 8)}..." http://your-server/api/sessions</code>
                        </p>
                    )}
                </CardContent>

                <AlertDialog open={showRegenConfirm} onOpenChange={setShowRegenConfirm}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t("webhooks.regenTitle")}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t("webhooks.regenDesc")}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t("ui.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => { setShowRegenConfirm(false); generateNewApiKey(); }} className="bg-red-600 hover:bg-red-700">{t("webhooks.regenerate")}</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </Card>

            {/* Webhooks Section */}
            <SessionGuard>
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Webhook className="h-5 w-5" /> {t("webhooks.webhooks")}
                                </CardTitle>
                                <CardDescription>
                                    {t("webhooks.webhooksDesc")}
                                </CardDescription>
                            </div>
                            <Button onClick={() => {
                                setNewName("");
                                setNewUrl("");
                                setNewSecret("");
                                setNewEvents(["message.received", "message.sent"]);
                                setShowNewForm(!showNewForm);
                            }}>
                                <Plus className="h-4 w-4 mr-2" /> {t("webhooks.add")}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {showNewForm && (
                            <Card className="border-dashed border-2">
                                <CardHeader><CardTitle>{t("webhooks.newTitle")}</CardTitle></CardHeader>
                                <CardContent className="pt-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>{t("webhooks.name")}</Label>
                                            <Input placeholder={t("webhooks.namePlaceholder")} value={newName} onChange={(e) => setNewName(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t("webhooks.url")}</Label>
                                            <Input placeholder="https://example.com/webhook" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t("webhooks.secret")}</Label>
                                        <Input placeholder="your-secret-key" value={newSecret} onChange={(e) => setNewSecret(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t("webhooks.events")}</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {AVAILABLE_EVENTS.map(event => (
                                                <div key={event.id} className="flex items-center gap-2 p-2 rounded border">
                                                    <Switch
                                                        checked={newEvents.includes(event.id)}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) setNewEvents([...newEvents, event.id]);
                                                            else setNewEvents(newEvents.filter(e => e !== event.id));
                                                        }}
                                                    />
                                                    <div>
                                                        <p className="text-sm font-medium">{eventLabel(event.id)}</p>
                                                        <p className="text-xs text-muted-foreground">{eventDesc(event.id)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <Button variant="ghost" onClick={() => setShowNewForm(false)}>{t("ui.cancel")}</Button>
                                        <Button onClick={handleSaveWebhook}>{t("webhooks.createButton")}</Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {loading ? (
                            <p className="text-center text-muted-foreground py-8">{t("ui.loading")}</p>
                        ) : webhooks.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                                {t("webhooks.empty")}
                            </p>
                        ) : (
                            webhooks.map((webhook) => {
                                const isTesting = testingId === webhook.id;
                                const testResult = testResults[webhook.id];

                                return (
                                    <Card key={webhook.id} className={webhook.isActive ? "" : "opacity-60"}>
                                        <CardContent className="pt-4 space-y-3">
                                            {/* Header */}
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-semibold flex items-center gap-2">
                                                        {webhook.name}
                                                        <Badge variant={webhook.isActive ? "default" : "secondary"}>
                                                            {webhook.isActive ? t("ui.active") : t("ui.inactive")}
                                                        </Badge>
                                                        {webhook.sessionId && (
                                                            <Badge variant="outline" className="text-xs">{webhook.sessionId}</Badge>
                                                        )}
                                                    </h3>
                                                    <p className="text-sm text-muted-foreground font-mono">{webhook.url}</p>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Switch
                                                        checked={webhook.isActive}
                                                        onCheckedChange={(checked) => toggleWebhookActive(webhook.id, checked)}
                                                    />
                                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(webhook)}>{t("ui.edit")}</Button>
                                                    <Button variant="ghost" size="icon" onClick={() => deleteWebhook(webhook.id)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Event Toggles */}
                                            <div className="space-y-2">
                                                <Label className="text-xs">{t("webhooks.eventsToggle")}</Label>
                                                <div className="flex flex-wrap gap-2">
                                                    {AVAILABLE_EVENTS.map(event => (
                                                        <Badge
                                                            key={event.id}
                                                            variant={webhook.events.includes(event.id) ? "default" : "outline"}
                                                            className="cursor-pointer"
                                                            onClick={() => toggleEventForWebhook(webhook.id, event.id)}
                                                        >
                                                            {eventLabel(event.id)}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Test & Logs Buttons */}
                                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleTestWebhook(webhook)}
                                                    disabled={isTesting}
                                                >
                                                    {isTesting ? (
                                                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                    ) : (
                                                        <Play className="h-4 w-4 mr-1" />
                                                    )}
                                                    {t("webhooks.test")}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openLogDialog(webhook)}
                                                >
                                                    <History className="h-4 w-4 mr-1" />
                                                    {t("webhooks.logs")}
                                                </Button>
                                            </div>

                                            {/* Test Result */}
                                            {testResult && !testResult.testing && (
                                                <div className={`p-3 rounded-md text-sm font-mono whitespace-pre-wrap ${
                                                    testResult.success
                                                        ? "bg-green-50 border border-green-200 text-green-800"
                                                        : "bg-red-50 border border-red-200 text-red-800"
                                                }`}>
                                                    <div className="flex items-center gap-2 mb-1 font-semibold">
                                                        {testResult.success ? t("webhooks.success") : t("webhooks.failed")}
                                                        <span className="text-xs font-normal text-muted-foreground">
                                                            {testResult.responseTimeMs}ms
                                                        </span>
                                                    </div>
                                                    {testResult.statusCode && (
                                                        <div>{t("webhooks.statusCode", { code: testResult.statusCode })}</div>
                                                    )}
                                                    {testResult.error && (
                                                        <div>{t("webhooks.error", { error: testResult.error })}</div>
                                                    )}
                                                    {testResult.responseBody && (
                                                        <details className="mt-1">
                                                            <summary className="cursor-pointer text-xs">{t("webhooks.responseBody")}</summary>
                                                            <pre className="mt-1 text-xs overflow-x-auto">{testResult.responseBody}</pre>
                                                        </details>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })
                        )}
                    </CardContent>
                </Card>
            </SessionGuard>

            {/* Edit Webhook Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{t("webhooks.editTitle")}</DialogTitle>
                        <DialogDescription>{t("webhooks.editDesc")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>{t("webhooks.name")}</Label>
                                <Input placeholder={t("webhooks.namePlaceholder")} value={editName} onChange={(e) => setEditName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>{t("webhooks.url")}</Label>
                                <Input placeholder="https://example.com/webhook" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>{t("webhooks.secret")}</Label>
                            <Input placeholder="your-secret-key" value={editSecret} onChange={(e) => setEditSecret(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>{t("webhooks.events")}</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {AVAILABLE_EVENTS.map(event => (
                                    <div key={event.id} className="flex items-center gap-2 p-2 rounded border">
                                        <Switch
                                            checked={editEvents.includes(event.id)}
                                            onCheckedChange={(checked) => {
                                                if (checked) setEditEvents([...editEvents, event.id]);
                                                else setEditEvents(editEvents.filter(e => e !== event.id));
                                            }}
                                        />
                                        <div>
                                            <p className="text-sm font-medium">{eventLabel(event.id)}</p>
                                            <p className="text-xs text-muted-foreground">{eventDesc(event.id)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setIsEditOpen(false)}>{t("ui.cancel")}</Button>
                        <Button onClick={handleUpdateWebhook}>{t("webhooks.saveChanges")}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("webhooks.deleteTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("webhooks.deleteDesc")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("ui.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">{t("ui.delete")}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Webhook Log Dialog */}
            {logDialogId && (
                <WebhookLogDialog
                    webhookId={logDialogId}
                    webhookName={logDialogName}
                    targetSessionId={logDialogSessionId}
                    open={!!logDialogId}
                    onClose={closeLogDialog}
                />
            )}
        </div>
    );
}
