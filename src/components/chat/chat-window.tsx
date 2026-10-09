"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ContactAvatar } from "@/components/contact-avatar";
import { Button } from "@/components/ui/button";
import { Send, Paperclip, ArrowLeft, FileText, Image as ImageIcon, Music, Video, Download, ArrowDown, CornerUpLeft, Copy, Trash2, Info, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getChatMessages, sendChatMessage, sendMediaMessage } from "@/app/dashboard/chat/actions";
import { useSocket } from "./socket-context";
import { useTranslation } from "@/components/i18n-provider";
import { translateValue, type Translator } from "@/lib/i18n/translate";

interface Message {
    id: string;
    keyId: string;
    content: string;
    fromMe: boolean;
    timestamp: string;
    type: string;
    status: string;
    pushName?: string;
    mediaUrl?: string;
    remoteJid?: string;
    quoteId?: string | null;
    quoted?: {
        keyId: string;
        content: string | null;
        fromMe: boolean;
        senderJid: string | null;
        pushName: string | null;
    } | null;
}

interface ChatWindowProps {
    sessionId: string;
    jid: string;
    name?: string;
    onBack?: () => void;
}

const PAGE_LIMIT = 50;

// ─── Lazy media (unchanged) ────────
function LazyMedia({ src, alt }: { src: string; alt: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { rootMargin: "200px" });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return (
        <div ref={ref} className="mb-1.5 overflow-hidden rounded-xl">
            {visible ? <img src={src} alt={alt} className={`max-w-full max-h-60 object-cover rounded-xl transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`} onLoad={() => setLoaded(true)} loading="lazy" />
                : <div className="h-40 bg-muted/30 rounded-xl animate-pulse" />}
        </div>
    );
}
function LazyVideo({ src }: { src: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { rootMargin: "200px" });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return (
        <div ref={ref} className="mb-1.5 overflow-hidden rounded-xl">
            {visible ? <video src={src} controls className="max-w-full max-h-60 rounded-xl" preload="none" />
                : <div className="h-32 bg-muted/30 rounded-xl animate-pulse flex items-center justify-center"><Video className="h-6 w-6 text-muted-foreground/50" /></div>}
        </div>
    );
}

function useDateLabel() {
    const { t, locale } = useTranslation();
    const cache = useRef(new Map<string, string>());
    return (timestamp: string): string => {
        const cacheKey = `${locale}:${timestamp}`;
        const cached = cache.current.get(cacheKey);
        if (cached) return cached;
        const date = new Date(timestamp);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        let label: string;
        if (diffDays === 0) label = t("chatWindow.today");
        else if (diffDays === 1) label = t("chatWindow.yesterday");
        else label = date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
        cache.current.set(cacheKey, label);
        return label;
    };
}

function handleDownload(url: string, fileName: string, t: Translator) {
    toast.info(t("chatWindow.downloading"));
    fetch(url).then(res => { if (!res.ok) throw new Error(); return res.blob(); }).then(blob => {
        const dlUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = dlUrl; link.download = fileName;
        document.body.appendChild(link);
        link.click(); link.remove();
        window.URL.revokeObjectURL(dlUrl);
    }).catch(() => toast.error(t("chatWindow.downloadFailed")));
}

// ─── Context Menu ──────────────────
interface ContextMenuState {
    x: number;
    y: number;
    msg: Message;
}
function ContextMenu({ state, onClose, onReply, onDelete }: { state: ContextMenuState; onClose: () => void; onReply: (msg: Message) => void; onDelete: (msg: Message) => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const { t, locale } = useTranslation();
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    const items = [
        { label: t("chatWindow.reply"), icon: CornerUpLeft, action: () => { onReply(state.msg); onClose(); } },
        { label: t("chatWindow.copy"), icon: Copy, action: () => { navigator.clipboard.writeText(state.msg.content || "").then(() => toast.success(t("chatWindow.copied"))).catch(() => {}); onClose(); } },
        { label: t("chatWindow.delete"), icon: Trash2, action: () => { onDelete(state.msg); onClose(); }, dangerous: true },
        { label: t("chatWindow.info"), icon: Info, action: () => { toast.info(t("chatWindow.infoText", { id: state.msg.keyId, status: translateValue(t, "status", state.msg.status), time: new Date(state.msg.timestamp).toLocaleString(locale) })); onClose(); } },
    ];

    // Adjust position to not overflow viewport
    const style: React.CSSProperties = { position: "fixed", top: state.y, left: state.x, zIndex: 9999 };
    if (state.x > window.innerWidth - 180) style.left = state.x - 180;
    if (state.y > window.innerHeight - 200) style.top = state.y - 180;

    return (
        <div ref={ref} style={style} className="w-44 rounded-xl bg-popover border shadow-xl py-1 animate-in fade-in zoom-in-95 origin-top-left">
            {items.map((item, i) => (
                <button key={i} onClick={item.action} className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors cursor-pointer",
                    item.dangerous ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-muted"
                )}>
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    {item.label}
                </button>
            ))}
        </div>
    );
}

// ─── Main Component ─────────────────
export function ChatWindow({ sessionId, jid, name, onBack }: ChatWindowProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const { t, locale } = useTranslation();
    const download = (url: string, fileName: string) => handleDownload(url, fileName, t);
    const scrollRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [uploadType, setUploadType] = useState<string>("image");
    const [isDragging, setIsDragging] = useState(false);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [oldestTimestamp, setOldestTimestamp] = useState<string | null>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [newMsgBadge, setNewMsgBadge] = useState(false);

    // Delete confirmation
    const [deleteConfirmMsg, setDeleteConfirmMsg] = useState<Message | null>(null);

    // Reply state
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

    const { getSocket, joinSession } = useSocket();
    const getDateLabel = useDateLabel();

    const scrollToBottom = useCallback((smooth = true) => {
        bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
    }, []);

    const fetchMessages = useCallback(async (before?: string) => {
        try {
            if (!before) setLoading(true);
            else setLoadingMore(true);
            const data: any = await getChatMessages(sessionId, jid, PAGE_LIMIT, before);
            if (!before) { setMessages(data.messages || []); setAutoScroll(true); }
            else if (data.messages?.length > 0) setMessages(prev => [...(data.messages || []), ...prev]);
            setHasMore(data.hasMore);
            if (data.messages?.length > 0) setOldestTimestamp(data.messages[0].timestamp);
        } catch (e) { console.error("Failed to load messages", e); }
        finally { setLoading(false); setLoadingMore(false); }
    }, [sessionId, jid]);

    useEffect(() => { setMessages([]); setOldestTimestamp(null); setHasMore(false); fetchMessages(); }, [fetchMessages]);

    // Auto focus input when chat changes and finished loading
    useEffect(() => {
        if (!loading && inputRef.current) {
            // A tiny delay ensures React has fully flushed the DOM for the new chat
            setTimeout(() => {
                inputRef.current?.focus();
            }, 10);
        }
    }, [jid, loading]);

    // Socket real-time
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        const onConnect = () => joinSession(sessionId);
        if (socket.connected) joinSession(sessionId);
        socket.on("connect", onConnect);
        const normalizedJid = jid.endsWith("@c.us") ? jid.replace("@c.us", "@s.whatsapp.net") : jid;
        const handler = (newMessages: Message[]) => {
            setMessages(prev => {
                const relevant = newMessages.filter(m => m.remoteJid === normalizedJid || prev.some(p => p.remoteJid === m.remoteJid));
                if (relevant.length === 0) return prev;
                const combined = [...prev, ...relevant];
                const unique = Array.from(new Map(combined.map(m => [m.keyId, m])).values());
                return unique.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            });
        };
        socket.on("message.update", handler);
        return () => { socket.off("connect", onConnect); socket.off("message.update", handler); };
    }, [sessionId, jid, getSocket, joinSession]);

    useEffect(() => { if (autoScroll) scrollToBottom(false); }, [messages, autoScroll, scrollToBottom]);

    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        setAutoScroll(atBottom);
        if (atBottom) setNewMsgBadge(false);
        if (el.scrollTop < 100 && hasMore && !loadingMore && oldestTimestamp) {
            const prevHeight = el.scrollHeight;
            fetchMessages(oldestTimestamp).then(() => {
                requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevHeight; });
            });
        }
    }, [hasMore, loadingMore, oldestTimestamp, fetchMessages]);

    const handleSend = async () => {
        if (!input.trim()) return;
        try {
            await sendChatMessage(sessionId, jid, input, replyingTo?.keyId);
            setInput("");
            setReplyingTo(null);
            setTimeout(() => fetchMessages(), 800);
        } catch (e: any) { toast.error(e.message || t("chatWindow.sendFailed")); }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    // Focus input when replying
    useEffect(() => {
        if (replyingTo && inputRef.current) {
            inputRef.current.focus();
        }
    }, [replyingTo]);

    // Global keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Escape: cancel reply
            if (e.key === "Escape" && replyingTo) {
                e.preventDefault();
                setReplyingTo(null);
                return;
            }
            // ? : show shortcuts
            if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.shiftKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
                toast.success(t("chatWindow.shortcuts"), {
                    description: t("chatWindow.shortcutsHelp")
                });
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [replyingTo, t]);

    const processFileUpload = async (file: File, explicitType?: string) => {
        const formData = new FormData();
        formData.append("file", file);
        let type = explicitType;
        if (!type || type === '*') {
            if (file.type.startsWith('image/')) type = 'image';
            else if (file.type.startsWith('video/')) type = 'video';
            else if (file.type.startsWith('audio/')) type = 'audio';
            else type = 'document';
        }
        formData.append("type", type);
        formData.append("sessionId", sessionId);
        formData.append("jid", jid);
        try {
            toast.info(t("chatWindow.sendingFile", { name: file.name }));
            await sendMediaMessage(formData);
            toast.success(t("chatWindow.sent"));
            setTimeout(() => fetchMessages(), 800);
        } catch (error: any) { toast.error(error.message || t("chatWindow.sendMediaFailed")); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await processFileUpload(file, uploadType);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const triggerUpload = (type: string) => {
        setUploadType(type);
        if (fileInputRef.current) {
            fileInputRef.current.accept = type === 'image' ? "image/*" : type === 'video' ? "video/*" : type === 'audio' ? "audio/*" : "*/*";
            fileInputRef.current.click();
        }
    };

    // Right-click handler
    const handleContextMenu = useCallback((e: React.MouseEvent, msg: Message) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, msg });
    }, []);

    const displayName = name || jid.split('@')[0];

    // Loading is now handled gracefully inside the message list to prevent unmounting the layout

    return (
        <div
            className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
                e.preventDefault(); setIsDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) processFileUpload(f);
            }}
        >
            {/* Context menu */}
            {contextMenu && (
                <ContextMenu
                    state={contextMenu}
                    onClose={() => setContextMenu(null)}
                    onReply={(msg) => { setReplyingTo(msg); scrollToBottom(true); }}
                    onDelete={(msg) => {
                        setDeleteConfirmMsg(msg);
                    }}
                />
            )}

            {/* Drag overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary flex items-center justify-center flex-col gap-3 rounded-lg m-2">
                    <Paperclip className="h-8 w-8 text-primary" />
                    <p className="text-lg font-semibold text-primary">{t("chatWindow.dropFiles")}</p>
                </div>
            )}

            {/* Delete confirmation dialog */}
            <AlertDialog open={!!deleteConfirmMsg} onOpenChange={(open) => { if (!open) setDeleteConfirmMsg(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("chatWindow.deleteTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("chatWindow.deleteDesc")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("ui.cancel")}</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                const msg = deleteConfirmMsg;
                                if (!msg) return;
                                fetch(`/api/messages/${sessionId}/${jid}/${msg.keyId}`, { method: "DELETE" })
                                    .then(() => { setMessages(p => p.filter(m => m.keyId !== msg.keyId)); toast.success(t("chatWindow.deleted")); })
                                    .catch(() => toast.error(t("chatWindow.deleteFailed")));
                                setDeleteConfirmMsg(null);
                            }}
                        >{t("chatWindow.delete")}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Loading older indicator */}
            {loadingMore && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm border text-xs flex items-center gap-2">
                    <div className="h-3 w-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    {t("chatWindow.loadingOlder")}
                </div>
            )}

            {/* Header */}
            <div className="z-10 flex h-16 shrink-0 items-center gap-3 border-b bg-card px-4">
                {onBack && (
                    <Button variant="ghost" size="icon" className="size-9 shrink-0 text-muted-foreground hover:text-foreground md:hidden" onClick={onBack} aria-label={t("chatWindow.back")}>
                        <ArrowLeft className="size-4" aria-hidden="true" />
                    </Button>
                )}
                <ContactAvatar sessionId={sessionId} jid={jid} name={displayName} />
                <div className="flex-1 min-w-0">
                    <h2 className="truncate text-[15px] font-semibold tracking-tight text-foreground">{displayName}</h2>
                    {jid.endsWith("@s.whatsapp.net") && (
                        <p className="truncate text-xs text-muted-foreground" data-numeric>+{jid.split("@")[0]}</p>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 min-h-0 styled-scrollbar" onScroll={handleScroll}
                style={{ backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--muted-foreground) / 0.04) 1px, transparent 0)`, backgroundSize: '24px 24px' }}
            >
                <div className="flex flex-col gap-3 max-w-3xl mx-auto">
                    {loading && messages.length === 0 && (
                        <div className="flex-1 flex items-center justify-center py-32">
                            <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        </div>
                    )}
                    {!hasMore && messages.length > 0 && (
                        <div className="text-center py-4">
                            <span className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">{t("chatWindow.beginning")}</span>
                        </div>
                    )}
                    {messages.length === 0 && !loading && (
                        <div className="flex-1 flex items-center justify-center py-16"><p className="text-sm text-muted-foreground">{t("chatWindow.noMessages")}</p></div>
                    )}
                    {messages.map((msg, idx) => {
                        const showDate = idx === 0 || getDateLabel(msg.timestamp) !== getDateLabel(messages[idx - 1].timestamp);
                        return (
                            <div key={msg.keyId} id={`msg-${msg.keyId}`}>
                                {showDate && (
                                    <div className="flex justify-center my-3">
                                        <span className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                                            {getDateLabel(msg.timestamp)}
                                        </span>
                                    </div>
                                )}
                                <div className={cn("flex gap-1 group", msg.fromMe ? "justify-end" : "justify-start")}>
                                    {/* Reply button: my msg on left */}
                                    {msg.fromMe && (
                                        <button onClick={() => { setReplyingTo(msg); scrollToBottom(true); }}
                                            className="order-first shrink-0 cursor-pointer self-center rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                                            title={t("chatWindow.reply")} aria-label={t("chatWindow.reply")}>
                                            <CornerUpLeft className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                    <div className={cn(
                                        "flex max-w-[85%] cursor-context-menu flex-col overflow-hidden rounded-2xl px-3 py-2 text-foreground sm:max-w-[68%]",
                                        msg.fromMe ? "rounded-br-md bg-bubble-out" : "rounded-bl-md border bg-card"
                                    )} onContextMenu={(e) => handleContextMenu(e, msg)}>
                                        {!msg.fromMe && jid.endsWith("@g.us") && msg.pushName && (
                                            <span className="mb-0.5 block text-xs font-semibold text-primary">{msg.pushName}</span>
                                        )}
                                        {msg.quoted && (
                                            <div 
                                                className={cn(
                                                    "mb-1.5 px-2 py-1 rounded-lg border-l-4 text-xs select-none cursor-pointer text-left bg-muted/40",
                                                    msg.fromMe
                                                        ? "border-primary/50 bg-card/60 text-muted-foreground hover:bg-card/80"
                                                        : "border-primary bg-muted text-muted-foreground hover:bg-muted/60"
                                                )}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const target = document.getElementById(`msg-${msg.quoted?.keyId}`);
                                                    if (target) {
                                                        target.scrollIntoView({ behavior: "smooth", block: "center" });
                                                        target.classList.add("bg-primary/10", "transition-colors", "duration-500");
                                                        setTimeout(() => {
                                                            target.classList.remove("bg-primary/10");
                                                        }, 1500);
                                                    } else {
                                                        toast.info(t("chatWindow.originalNotLoaded"));
                                                    }
                                                }}
                                            >
                                                <span className="font-semibold block text-xs">
                                                    {msg.quoted.fromMe ? t("chatWindow.you") : (msg.quoted.pushName || msg.quoted.senderJid?.split('@')[0] || t("chatWindow.contact"))}
                                                </span>
                                                <span className="line-clamp-2 block break-all text-xs">
                                                    {msg.quoted.content || t("chatWindow.media")}
                                                </span>
                                            </div>
                                        )}
                                        {/* IMAGE */}
                                        {msg.type === 'IMAGE' && msg.mediaUrl && (
                                            <div className="relative group/media">
                                                <LazyMedia src={msg.mediaUrl} alt={t("chatWindow.image")} />
                                                <Button size="icon" variant="secondary" className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover/media:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
                                                    onClick={() => download(msg.mediaUrl!, `IMAGE-${msg.keyId}.jpg`)}><Download className="h-4 w-4" /></Button>
                                            </div>
                                        )}
                                        {/* VIDEO */}
                                        {msg.type === 'VIDEO' && msg.mediaUrl && (
                                            <div className="relative group/media">
                                                <LazyVideo src={msg.mediaUrl} />
                                                <Button size="icon" variant="secondary" className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover/media:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm z-10"
                                                    onClick={() => download(msg.mediaUrl!, `VIDEO-${msg.keyId}.mp4`)}><Download className="h-4 w-4" /></Button>
                                            </div>
                                        )}
                                        {/* AUDIO */}
                                        {msg.type === 'AUDIO' && msg.mediaUrl && (
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <audio src={msg.mediaUrl} controls className="h-8 max-w-[200px]" preload="none" />
                                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => download(msg.mediaUrl!, `AUDIO-${msg.keyId}.mp3`)}><Download className="h-3.5 w-3.5" /></Button>
                                            </div>
                                        )}
                                        {/* STICKER */}
                                        {msg.type === 'STICKER' && msg.mediaUrl && (
                                            <div className="relative group/media mb-1">
                                                <img src={msg.mediaUrl} alt="Sticker" className="max-h-32 object-contain rounded-lg" loading="lazy" />
                                                <Button size="icon" variant="secondary" className="absolute -top-1 -right-1 h-6 w-6 rounded-full opacity-0 group-hover/media:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
                                                    onClick={() => download(msg.mediaUrl!, `STICKER-${msg.keyId}.webp`)}><Download className="h-3 w-3" /></Button>
                                            </div>
                                        )}
                                        {/* DOCUMENT */}
                                        {msg.type !== 'TEXT' && msg.type !== 'IMAGE' && msg.type !== 'STICKER' && msg.type !== 'VIDEO' && msg.type !== 'AUDIO' && (
                                            <div className={cn("mb-1 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5", msg.fromMe ? "bg-card/60" : "bg-muted/60")}>
                                                <div className="flex items-center gap-2 truncate min-w-0">
                                                    <FileText className="h-3.5 w-3.5 shrink-0" />
                                                    <span className="text-xs font-medium truncate">{t("chatWindow.typeMessage", { type: translateValue(t, "messageTypes", msg.type) })}</span>
                                                </div>
                                                {msg.mediaUrl && <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full shrink-0" onClick={() => download(msg.mediaUrl!, `${msg.type}-${msg.keyId}`)}><Download className="h-3.5 w-3.5" /></Button>}
                                            </div>
                                        )}
                                        {/* Text */}
                                        <div className="flex items-end gap-2">
                                            <span className="flex-1 whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{msg.content}</span>
                                            <span className="shrink-0 translate-y-0.5 text-[11px] leading-none text-muted-foreground" data-numeric>
                                                {new Date(msg.timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Reply button: other msg on right */}
                                    {!msg.fromMe && (
                                        <button onClick={() => { setReplyingTo(msg); scrollToBottom(true); }}
                                            className="shrink-0 cursor-pointer self-center rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                                            aria-label={t("chatWindow.reply")}
                                            title={t("chatWindow.reply")}>
                                            <CornerUpLeft className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>
            </div>

            {/* New message badge */}
            {newMsgBadge && (
                <button onClick={() => { scrollToBottom(true); setNewMsgBadge(false); }}
                    className="absolute bottom-[90px] right-6 z-20 flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90">
                    <ArrowDown className="h-4 w-4" /> {t("chatWindow.newMessages")}
                </button>
            )}

            {/* Input */}
            <div className="shrink-0 border-t bg-card px-3 py-3 sm:px-4">
                <div className="flex items-center gap-2 max-w-3xl mx-auto">
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-10 shrink-0 text-muted-foreground hover:text-foreground" aria-label={t("chatWindow.attach")}><Paperclip className="size-[18px]" aria-hidden="true" /></Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-44 p-1.5" side="top" align="start">
                            <div className="flex flex-col gap-0.5">
                                <Button variant="ghost" size="sm" className="justify-start gap-2 h-8 text-xs" onClick={() => triggerUpload('image')}><ImageIcon className="h-3.5 w-3.5 text-info" /> {t("chatWindow.image")}</Button>
                                <Button variant="ghost" size="sm" className="justify-start gap-2 h-8 text-xs" onClick={() => triggerUpload('video')}><Video className="h-3.5 w-3.5 text-chart-4" /> {t("chatWindow.video")}</Button>
                                <Button variant="ghost" size="sm" className="justify-start gap-2 h-8 text-xs" onClick={() => triggerUpload('audio')}><Music className="h-3.5 w-3.5 text-warning" /> {t("chatWindow.audio")}</Button>
                                <Button variant="ghost" size="sm" className="justify-start gap-2 h-8 text-xs" onClick={() => triggerUpload('document')}><FileText className="h-3.5 w-3.5 text-success" /> {t("chatWindow.document")}</Button>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <div className="flex-1">
                        {/* Reply preview bar */}
                        {replyingTo && (
                            <div className="mb-2 flex items-start gap-2 overflow-hidden rounded-lg border-l-2 border-primary bg-muted/60 px-2 py-1.5 text-xs animate-in slide-in-from-bottom-1">
                                <div className="flex-1 min-w-0 overflow-hidden">
                                    <span className="block text-xs font-semibold text-primary">{t("chatWindow.replyingTo", { name: replyingTo.fromMe ? t("chatWindow.replyingToYou") : (replyingTo.pushName || jid.split('@')[0]) })}</span>
                                    <span className="text-muted-foreground truncate block w-full">{replyingTo.content || `[${replyingTo.type}]`}</span>
                                </div>
                                <button onClick={() => setReplyingTo(null)} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label={t("chatWindow.cancelReply")}><X className="size-3.5" aria-hidden="true" /></button>
                            </div>
                        )}
                        <div className="flex items-end gap-2 rounded-xl border border-input/70 bg-background p-1 transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
                            <textarea ref={inputRef} value={input} onChange={(e) => { setInput(e.target.value); const el = e.target; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }}
                                onKeyDown={handleKeyDown} placeholder={t("chatWindow.placeholder")} rows={1} style={{ minHeight: "36px", maxHeight: "120px" }}
                                aria-label={t("chatWindow.placeholder")}
                                className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-normal text-foreground placeholder:text-muted-foreground focus:outline-none" />
                        </div>
                    </div>

                    <Button onClick={handleSend} disabled={!input.trim()} size="icon" className="size-10 shrink-0 rounded-full" aria-label={t("chatWindow.send")}><Send className="size-4" aria-hidden="true" /></Button>
                </div>
            </div>
        </div>
    );
}
