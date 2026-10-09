"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Play, Square, RotateCcw, LogOut, Power, Trash2, QrCode, Activity, HardDrive, Wifi, MemoryStick, Copy, Check } from "lucide-react";
import Link from "next/link";
import { io, Socket } from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@/components/i18n-provider";
import { translateValue } from "@/lib/i18n/translate";

type SessionDetail = {
    id: string;
    name: string;
    sessionId: string;
    status: string;
    userId: string;
    uptime: number; // in seconds
    me?: {
        id: string;
        name: string;
    };
    hasInstance: boolean;
};

export default function SessionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const sessionId = params.sessionId as string;
    const { t } = useTranslation();

    const [session, setSession] = useState<SessionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [uptime, setUptime] = useState(0);
    const [systemMetrics, setSystemMetrics] = useState<any>(null);
    const [phoneNumber, setPhoneNumber] = useState("");
    const [pairingCode, setPairingCode] = useState<string | null>(null);
    const [isPairing, setIsPairing] = useState(false);

    const fetchSession = async () => {
        try {
            const res = await fetch(`/api/sessions/${sessionId}`);
            if (!res.ok) {
                if (res.status === 404) {
                    toast.error(t("sessionDetail.notFound"));
                    router.push("/dashboard/sessions");
                    return;
                }
                throw new Error("Failed to fetch");
            }
            const responseData = await res.json();
            const data = responseData?.data;
            if (!data) throw new Error("No data returned");
            setSession(data);
            setQrCode(data.qr || null);
            setPairingCode(data.pairingCode || null);
            setUptime(data.uptime || 0);
        } catch (error) {
            console.error(error);
            toast.error(t("sessionDetail.loadFailed"));
        } finally {
            setLoading(false);
        }
    };

    const fetchMetrics = async () => {
        try {
            const res = await fetch(`/api/system/monitor/${sessionId}`);
            const result = await res.json();
            if (result.status) {
                setSystemMetrics(result.data);
            }
        } catch (e) {
            // silent ignore
        }
    };

    useEffect(() => {
        fetchSession();

        const socketInstance = io({
            path: "/api/socket/io",
            addTrailingSlash: false,
        });

        socketInstance.on("connect", () => {
            console.log("Connected to socket");
            socketInstance.emit("join-session", sessionId);
        });

        socketInstance.on("connection.update", (data: { status: string, qr: string, pairingCode?: string }) => {
            console.log("Socket update:", data);
            setSession(prev => prev ? { ...prev, status: data.status } : null);
            setQrCode(data.qr || null);
            if (data.pairingCode) setPairingCode(data.pairingCode);

            // Re-fetch full details on major status change (like connection) to get 'me' info
            if (data.status === 'CONNECTED') {
                fetchSession();
            }
        });

        setSocket(socketInstance);

        // Uptime counter
        const interval = setInterval(() => {
            setUptime(prev => prev + 1);
        }, 1000);

        // Fetch metrics periodically
        fetchMetrics();
        const metricsInterval = setInterval(fetchMetrics, 3000);

        return () => {
            socketInstance.disconnect();
            clearInterval(interval);
            clearInterval(metricsInterval);
        };
    }, [sessionId]);

    const performAction = async (action: string, payload: any = {}) => {
        const loadingToast = toast.loading(t("sessionDetail.performing", { action }));
        try {
            const res = await fetch(`/api/sessions/${sessionId}/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || data.error || t("sessionDetail.actionFailed"));

            toast.success(data.message || t("ui.success"));

            // Refresh logic
            if (action === 'logout') {
                setQrCode(null);
                setPairingCode(null);
            }
            if (action === 'pair' && data.data?.pairingCode) {
                setPairingCode(data.data.pairingCode);
            }
            fetchSession();

        } catch (error: any) {
            toast.error(error.message);
        } finally {
            toast.dismiss(loadingToast);
        }
    };

    const handlePairingRequest = async () => {
        if (!phoneNumber) {
            toast.error(t("sessionDetail.enterPhone"));
            return;
        }
        setIsPairing(true);
        await performAction('pair', { phoneNumber });
        setIsPairing(false);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success(t("ui.copied"));
    };

    const deleteSession = async () => {
        try {
            const res = await fetch(`/api/sessions/${sessionId}/settings`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(t("sessionDetail.deleted"));
                router.push("/dashboard/sessions");
            } else {
                toast.error(t("sessionDetail.deleteFailed"));
            }
        } catch (e) {
            toast.error(t("sessionDetail.deleteError"));
        }
    };

    const formatUptime = (seconds: number) => {
        if (!session?.status || session.status !== "CONNECTED") return t("sessionDetail.offline");
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor((seconds % (3600 * 24)) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${d}d ${h}h ${m}m ${s}s`;
    };

    if (loading) return <div className="p-8">{t("ui.loading")}</div>;
    if (!session) return <div className="p-8">{t("sessionDetail.notFound")}</div>;

    return (
        <div className="mx-auto w-full max-w-6xl space-y-6">
            <div className="flex flex-col gap-2">
                <Button variant="ghost" size="sm" asChild className="-ml-2 self-start text-muted-foreground">
                    <Link href="/dashboard/sessions">
                        <ArrowLeft className="mr-2 h-4 w-4" /> {t("sessionDetail.back")}
                    </Link>
                </Button>
                <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground truncate">
                    {session.name} <span className="mt-1 block font-mono text-sm font-normal text-muted-foreground sm:mt-0 sm:inline">({session.sessionId})</span>
                </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Status Card */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            {t("sessionDetail.statusTitle")}
                            <div className={`px-3 py-1 rounded-full text-xs font-bold ${session.status === 'CONNECTED' ? 'bg-success/10 text-success' :
                                session.status === 'STOPPED' ? 'bg-destructive/10 text-destructive' :
                                    'bg-warning/10 text-warning'
                                }`}>
                                {translateValue(t, "status", session.status)}
                            </div>
                        </CardTitle>
                        <CardDescription>{t("sessionDetail.statusDesc")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-muted/50 rounded-lg">
                                <span className="text-sm text-muted-foreground block">{t("sessionDetail.uptime")}</span>
                                <span className="text-xl font-mono font-medium">{formatUptime(uptime)}</span>
                            </div>
                            <div className="p-4 bg-muted/50 rounded-lg">
                                <span className="text-sm text-muted-foreground block">{t("sessionDetail.connectedAs")}</span>
                                <span className="text-lg font-medium truncate">{session.me?.name || session.me?.id || "-"}</span>
                            </div>
                        </div>

                        {/* System Resource Extension */}
                        {session.status === 'CONNECTED' && systemMetrics && (
                            <div className="mt-4 pt-4 border-t">
                                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Activity className="h-4 w-4" /> {t("sessionDetail.systemHealth")}</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-muted/50 p-3 rounded border text-center relative overflow-hidden">
                                        <Wifi className="h-4 w-4 text-muted-foreground absolute top-2 right-2" />
                                        <div className="text-xs text-muted-foreground">{t("sessionDetail.pingState")}</div>
                                        <div className="font-bold text-success mt-1">{systemMetrics.ping}</div>
                                    </div>
                                    <div className="bg-muted/50 p-3 rounded border text-center">
                                        <div className="text-xs text-muted-foreground">{t("sessionDetail.storeContacts")}</div>
                                        <div className="font-bold text-foreground/90 mt-1">{systemMetrics.store?.contacts || 0}</div>
                                    </div>
                                    <div className="bg-muted/50 p-3 rounded border text-center">
                                        <div className="text-xs text-muted-foreground">{t("sessionDetail.storeChats")}</div>
                                        <div className="font-bold text-foreground/90 mt-1">{systemMetrics.store?.chats || 0}</div>
                                    </div>
                                    <div className="bg-muted/50 p-3 rounded border text-center relative">
                                        <MemoryStick className="h-4 w-4 text-muted-foreground absolute top-2 right-2 opacity-50" />
                                        <div className="text-xs text-muted-foreground">{t("sessionDetail.storeMsgs")}</div>
                                        <div className="font-bold text-foreground/90 mt-1">{systemMetrics.store?.messages || 0}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {qrCode && (
                            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-card relative group">
                                <QRCodeSVG value={qrCode} size={256} />
                                <p className="mt-4 text-sm text-muted-foreground animate-pulse">{t("sessionDetail.scanToConnect")}</p>

                                <div className="mt-6 pt-6 border-t w-full">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="text-xs text-muted-foreground font-semibold">{t("sessionDetail.orLinkPhone")}</div>
                                        <div className="flex flex-col w-full max-w-sm gap-2 mt-1">
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="628123456789"
                                                    value={phoneNumber}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhoneNumber(e.target.value)}
                                                    className="font-mono"
                                                />
                                                <Button onClick={handlePairingRequest} disabled={isPairing || !phoneNumber}>
                                                    {t("sessionDetail.link")}
                                                </Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground text-center">{t("sessionDetail.phoneHint")}</p>
                                        </div>
                                        {pairingCode && (
                                            <div className="mt-4 p-4 bg-muted rounded-lg w-full max-w-[320px] text-center border border-border relative group/code">
                                                <div className="text-xs text-muted-foreground tracking-[0.2em] mb-2 font-semibold">{t("sessionDetail.yourPairingCode")}</div>
                                                <div
                                                    className="text-3xl font-mono font-bold text-foreground tracking-[0.3em] flex justify-center cursor-pointer hover:text-primary transition-colors py-2"
                                                    onClick={() => copyToClipboard(pairingCode)}
                                                    title={t("ui.clickToCopy")}
                                                >
                                                    {pairingCode.toUpperCase().replace('-', '').split('').map((char, i) => (
                                                        <span key={i} className="flex items-center">
                                                            {char}
                                                            {i === 3 && <span className="mx-2 text-muted-foreground opacity-50">-</span>}
                                                        </span>
                                                    ))}
                                                </div>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground"
                                                    onClick={() => copyToClipboard(pairingCode)}
                                                >
                                                    <Copy className="h-3.5 w-3.5" />
                                                </Button>
                                                <div className="text-xs text-muted-foreground mt-2 italic">{t("sessionDetail.enterCodeOnPhone")}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Actions Panel */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t("sessionDetail.controls")}</CardTitle>
                        <CardDescription>{t("sessionDetail.controlsDesc")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button
                            variant="outline"
                            className="w-full justify-start text-success hover:text-success hover:bg-success/10"
                            onClick={() => performAction('start')}
                            disabled={session.status === 'CONNECTED' || session.status === 'SCAN_QR'}
                        >
                            <Play className="mr-2 h-4 w-4" /> {t("sessionDetail.start")}
                        </Button>

                        <Button
                            variant="outline"
                            className="w-full justify-start text-warning hover:text-warning hover:bg-warning/10"
                            onClick={() => performAction('restart')}
                            disabled={!session.hasInstance && session.status !== 'CONNECTED'}
                        >
                            <RotateCcw className="mr-2 h-4 w-4" /> {t("sessionDetail.restart")}
                        </Button>

                        <Button
                            variant="outline"
                            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => performAction('stop')}
                            disabled={session.status === 'STOPPED'}
                        >
                            <Square className="mr-2 h-4 w-4" /> {t("sessionDetail.stop")}
                        </Button>

                        <div className="border-t my-4 pt-4 space-y-3">
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => performAction('logout')}
                                disabled={session.status !== 'CONNECTED'}
                            >
                                <LogOut className="mr-2 h-4 w-4" /> {t("sessionDetail.logout")}
                            </Button>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="destructive"
                                        className="w-full justify-start"
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" /> {t("sessionDetail.delete")}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>{t("sessionDetail.confirmTitle")}</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            {t("sessionDetail.confirmDesc")}
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>{t("ui.cancel")}</AlertDialogCancel>
                                        <AlertDialogAction onClick={deleteSession} className="bg-destructive hover:bg-destructive">
                                            {t("ui.delete")}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
