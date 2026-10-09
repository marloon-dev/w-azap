'use client';

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import QRCode from 'qrcode';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { useRouter } from 'next/navigation';
import { toast } from "sonner";
import { Label } from '@/components/ui/label';
import { Smartphone, Plus, Trash2, Settings, RefreshCw, Power, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/components/i18n-provider";
import { translateValue } from "@/lib/i18n/translate";
import { EmptyState } from "@/components/dashboard/empty-state";
import { cn } from "@/lib/utils";

type Session = {
    id: string;
    name: string;
    sessionId: string;
    status: string;
    qr?: string | null;
    user?: {
        name: string | null;
        email: string;
    } | null;
};

export function SessionManager({ user }: { user: any }) {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [newSessionName, setNewSessionName] = useState("");
    const [newSessionId, setNewSessionId] = useState("");
    const [loading, setLoading] = useState(false);
    const [socket, setSocket] = useState<Socket | null>(null);
    const router = useRouter();
    const { t } = useTranslation();

    useEffect(() => {
        fetchSessions();

        // Init Socket
        const socketInstance = io({
            path: "/api/socket/io",
            addTrailingSlash: false,
        });

        socketInstance.on('connect', () => {
            console.log('Socket connected');
        });

        socketInstance.on('connection.update', (data: { sessionId: string, status: string, qr: string }) => {
            // Update specific session status if match
            setSessions(prev => prev.map(s => {
                if (s.sessionId === data.sessionId) {
                    return { ...s, status: data.status, qr: data.qr };
                }
                return s;
            }));

            if (data.status === 'CONNECTED') {
                fetchSessions(); // Refresh purely to get updated state from DB if needed
            }
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, []);

    const fetchSessions = () => {
        fetch('/api/sessions').then(res => res.json()).then(responseData => {
            const data = responseData?.data || [];
            if (Array.isArray(data)) setSessions(data);
        });
    }

    const createSession = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (!newSessionName) {
            toast.error(t("sessions.nameRequired"));
            return;
        }

        // If ID matches existing
        if (newSessionId && sessions.some(s => s.sessionId === newSessionId)) {
            toast.error(t("sessions.idExists"));
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    name: newSessionName,
                    sessionId: newSessionId || undefined // Optional, backend will generate if empty
                })
            });
            const responseData = await res.json();
            const session = responseData?.data;

            if (!res.ok || !session) throw new Error(responseData.error || responseData.message || t("sessions.createFailed"));

            setSessions([...sessions, session]);
            setNewSessionName("");
            setNewSessionId("");
            toast.success(t("sessions.created"));

            // Optionally redirect immediately or let user choose
            // router.push(`/dashboard/sessions/${session.sessionId}`);
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || t("sessions.createFailed"));
        } finally {
            setLoading(false);
        }
    };

    const handleManageSession = (sessionId: string) => {
        router.push(`/dashboard/sessions/${sessionId}`);
    }

    const statusBadge = (status: string) => {
        const connected = status === "CONNECTED";
        return (
            <span
                className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                    connected ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
                )}
            >
                <span className={cn("size-1.5 rounded-full", connected ? "bg-success" : "bg-muted-foreground")} aria-hidden="true" />
                {translateValue(t, "status", status)}
            </span>
        );
    };

    const rowActions = (session: Session) => (
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => router.push(`/dashboard/sessions/access?session=${session.sessionId}`)}
            >
                <UserPlus className="size-4" aria-hidden="true" /> {t("sessions.share")}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleManageSession(session.sessionId)}>
                <Settings className="size-4" aria-hidden="true" /> {t("sessions.manage")}
            </Button>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Create new session */}
            <Card className="gap-4">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Plus className="size-4 text-primary" aria-hidden="true" /> {t("sessions.createTitle")}
                    </CardTitle>
                    <CardDescription>{t("sessions.createDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={createSession} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-start">
                        <div className="space-y-2">
                            <Label htmlFor="session-name">{t("sessions.nameLabel")}</Label>
                            <Input
                                id="session-name"
                                value={newSessionName}
                                onChange={e => setNewSessionName(e.target.value)}
                                placeholder={t("sessions.namePlaceholder")}
                                required
                                maxLength={100}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="session-id">{t("sessions.customIdLabel")}</Label>
                            <Input
                                id="session-id"
                                value={newSessionId}
                                onChange={e => setNewSessionId(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
                                placeholder="unique-id-123"
                                aria-describedby="session-id-hint"
                                maxLength={50}
                                className="font-mono"
                            />
                            <p id="session-id-hint" className="text-xs text-muted-foreground">{t("sessions.idHint")}</p>
                        </div>
                        {/* Label height + gap keeps the button aligned with the inputs on desktop */}
                        <div className="md:pt-[1.375rem]">
                            <Button type="submit" disabled={loading} className="w-full md:w-auto">
                                {loading ? t("ui.creating") : t("sessions.createButton")}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Sessions */}
            {sessions.length === 0 ? (
                <Card className="border-dashed py-0 shadow-none">
                    <EmptyState icon={Smartphone} title={t("sessions.empty")} />
                </Card>
            ) : (
                <Card className="gap-0 overflow-hidden py-0">
                    <CardHeader className="border-b px-5 py-4 [.border-b]:pb-4">
                        <CardTitle className="text-base">{t("sessions.activeTitle", { count: sessions.length })}</CardTitle>
                        <CardDescription>{t("sessions.activeDesc")}</CardDescription>
                    </CardHeader>

                    {/* Desktop: table */}
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="px-5">{t("sessions.colSession")}</TableHead>
                                    <TableHead>{t("ui.status")}</TableHead>
                                    <TableHead>{t("sessions.colOwner")}</TableHead>
                                    <TableHead className="px-5 text-right">{t("ui.actions")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sessions.map(session => (
                                    <TableRow key={session.id}>
                                        <TableCell className="px-5 py-3">
                                            <div className="text-sm font-medium text-foreground">{session.name}</div>
                                            <div className="mt-0.5 font-mono text-xs text-muted-foreground">{session.sessionId}</div>
                                        </TableCell>
                                        <TableCell className="py-3">{statusBadge(session.status)}</TableCell>
                                        <TableCell className="py-3">
                                            {session.user ? (
                                                <div className="leading-tight">
                                                    <div className="text-sm text-foreground">{session.user.name || t("ui.noName")}</div>
                                                    <div className="mt-0.5 text-xs text-muted-foreground">{session.user.email}</div>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-5 py-3">
                                            <div className="flex justify-end">{rowActions(session)}</div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile: stacked list */}
                    <ul className="divide-y md:hidden">
                        {sessions.map(session => (
                            <li key={session.id} className="space-y-3 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-foreground">{session.name}</p>
                                        <p className="truncate font-mono text-xs text-muted-foreground">{session.sessionId}</p>
                                        {session.user && (
                                            <p className="mt-1 truncate text-xs text-muted-foreground">{session.user.name || session.user.email}</p>
                                        )}
                                    </div>
                                    {statusBadge(session.status)}
                                </div>
                                {rowActions(session)}
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </div>
    );
}
