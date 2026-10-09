"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Trash2, Shield, ShieldCheck, ShieldAlert, User, Users, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
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
import { useTranslation } from "@/components/i18n-provider";
import { translateValue } from "@/lib/i18n/translate";

interface SessionInfo {
    id: string;
    sessionId: string;
    name: string;
    userId: string;
    status: string;
}

interface AccessEntry {
    id: string;
    sessionId: string;
    userId: string;
    createdAt: string;
    user: {
        id: string;
        name: string | null;
        email: string;
        role: string;
    };
}

export default function SessionAccessPage() {
    const { data: authSession } = useSession();
    const searchParams = useSearchParams();
    const { t, locale } = useTranslation();
    const sessionFromUrl = searchParams.get("session") || "";
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [selectedSession, setSelectedSession] = useState<string>(sessionFromUrl);
    const [accessList, setAccessList] = useState<AccessEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [accessLoading, setAccessLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // For revoke confirmation
    const [revokeTarget, setRevokeTarget] = useState<AccessEntry | null>(null);

    // @ts-ignore
    const currentUserId = authSession?.user?.id;
    // @ts-ignore
    const currentUserRole = authSession?.user?.role;

    // Fetch user's owned sessions — wait for authSession to be ready
    useEffect(() => {
        if (!authSession?.user) return; // Wait until session is loaded
        fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authSession?.user]);

    const fetchSessions = async () => {
        try {
            const res = await fetch("/api/sessions");
            if (res.ok) {
                const data = await res.json();
                const allSessions: SessionInfo[] = data?.data || [];
                // Filter to show only sessions owned by the current user (not shared ones)
                // SUPERADMIN sees all sessions
                const owned = currentUserRole === "SUPERADMIN"
                    ? allSessions
                    : allSessions.filter((s: SessionInfo) => s.userId === currentUserId);
                setSessions(owned);
                if (owned.length > 0 && !selectedSession) {
                    setSelectedSession(owned[0].sessionId);
                }
            }
        } catch (error) {
            console.error("Failed to fetch sessions", error);
            toast.error(t("sessionAccess.loadSessionsFailed"));
        } finally {
            setLoading(false);
        }
    };

    const fetchAccessList = useCallback(async () => {
        if (!selectedSession) return;
        setAccessLoading(true);
        try {
            const res = await fetch(`/api/sessions/${selectedSession}/access`);
            if (res.ok) {
                const data = await res.json();
                setAccessList(data?.data || []);
            } else if (res.status === 403) {
                toast.error(t("sessionAccess.noPermission"));
                setAccessList([]);
            } else {
                setAccessList([]);
            }
        } catch (error) {
            console.error("Failed to fetch access list", error);
            toast.error(t("sessionAccess.loadAccessFailed"));
        } finally {
            setAccessLoading(false);
        }
    }, [selectedSession, t]);

    useEffect(() => {
        if (selectedSession) {
            fetchAccessList();
        }
    }, [selectedSession, fetchAccessList]);

    const handleGrantAccess = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !selectedSession) return;

        setSubmitting(true);
        try {
            const res = await fetch(`/api/sessions/${selectedSession}/access`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim() })
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(data.message || t("sessionAccess.granted"));
                setEmail("");
                fetchAccessList();
            } else {
                toast.error(data.message || t("sessionAccess.grantFailed"));
            }
        } catch (error) {
            toast.error(t("sessionAccess.grantFailed"));
        } finally {
            setSubmitting(false);
        }
    };

    const confirmRevoke = async () => {
        if (!revokeTarget || !selectedSession) return;

        try {
            const res = await fetch(`/api/sessions/${selectedSession}/access`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: revokeTarget.user.id })
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(t("sessionAccess.revoked"));
                fetchAccessList();
            } else {
                toast.error(data.message || t("sessionAccess.revokeFailed"));
            }
        } catch (error) {
            toast.error(t("sessionAccess.revokeFailed"));
        } finally {
            setRevokeTarget(null);
        }
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case "SUPERADMIN": return <ShieldAlert className="h-4 w-4 text-destructive" />;
            case "OWNER": return <ShieldCheck className="h-4 w-4 text-info" />;
            default: return <User className="h-4 w-4 text-muted-foreground" />;
        }
    };

    const getRoleBadgeVariant = (role: string) => {
        switch (role) {
            case "SUPERADMIN": return "destructive" as const;
            case "OWNER": return "default" as const;
            default: return "secondary" as const;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">{t("sessionAccess.loadingSessions")}</span>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-6xl space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground">
                        {t("sessionAccess.title")}
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        {t("sessionAccess.subtitle")}
                    </p>
                </div>
            </div>

            {/* Session Selector */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t("sessionAccess.selectTitle")}</CardTitle>
                    <CardDescription>
                        {t("sessionAccess.selectDesc")}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {sessions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {t("sessionAccess.noSessions")}
                        </p>
                    ) : (
                        <Select value={selectedSession} onValueChange={setSelectedSession}>
                            <SelectTrigger className="w-full sm:w-[360px]">
                                <SelectValue placeholder={t("sessionAccess.selectPlaceholder")} />
                            </SelectTrigger>
                            <SelectContent>
                                {sessions.map(s => (
                                    <SelectItem key={s.sessionId} value={s.sessionId}>
                                        <div className="flex items-center gap-2">
                                            <span className={`h-2 w-2 rounded-full ${s.status === "CONNECTED" ? "bg-success" : "bg-muted-foreground"}`} />
                                            {s.name} <span className="text-muted-foreground">({s.sessionId})</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </CardContent>
            </Card>

            {/* Grant Access Form */}
            {selectedSession && (
                <Card className="border-2 border-primary/20">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <UserPlus className="h-4 w-4" /> {t("sessionAccess.grantTitle")}
                        </CardTitle>
                        <CardDescription>
                            {t("sessionAccess.grantDesc")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleGrantAccess} className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1 space-y-1.5">
                                <Label htmlFor="email" className="sr-only">{t("auth.email")}</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="user@example.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    disabled={submitting}
                                />
                            </div>
                            <Button type="submit" disabled={submitting || !email.trim()}>
                                {submitting ? (
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("sessionAccess.granting")}</>
                                ) : (
                                    <><UserPlus className="h-4 w-4 mr-2" /> {t("sessionAccess.grantTitle")}</>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Access List */}
            {selectedSession && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Users className="h-4 w-4" /> {t("sessionAccess.usersWithAccess")}
                            <Badge variant="outline" className="ml-auto">{t("sessionAccess.userCount", { count: accessList.length })}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {accessLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                <span className="ml-2 text-sm text-muted-foreground">{t("ui.loading")}</span>
                            </div>
                        ) : accessList.length === 0 ? (
                            <div className="text-center py-8">
                                <Shield className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                                <p className="text-sm text-muted-foreground">
                                    {t("sessionAccess.noUsers")}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {accessList.map(entry => (
                                    <div
                                        key={entry.id}
                                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-info/20 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                                                {entry.user.name?.charAt(0)?.toUpperCase() || entry.user.email.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm truncate">
                                                    {entry.user.name || t("common.user")}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {entry.user.email}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                            <Badge variant={getRoleBadgeVariant(entry.user.role)} className="hidden sm:flex items-center gap-1 text-xs">
                                                {getRoleIcon(entry.user.role)}
                                                {translateValue(t, "roles", entry.user.role)}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground hidden md:inline">
                                                {new Date(entry.createdAt).toLocaleDateString(locale)}
                                            </span>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                                                onClick={() => setRevokeTarget(entry)}
                                                title={t("sessionAccess.revokeTitle")}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Revoke Confirmation Dialog */}
            <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("sessionAccess.revokeConfirmTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("sessionAccess.revokeConfirmPrefix")}{" "}
                            <strong>{revokeTarget?.user.name || revokeTarget?.user.email}</strong>?{" "}
                            {t("sessionAccess.revokeConfirmSuffix")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("ui.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmRevoke} className="bg-destructive hover:bg-destructive">
                            {t("sessionAccess.revokeButton")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
