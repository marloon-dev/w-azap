"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessageSquarePlus, Search, MessageCircle, X, Tag, MoreHorizontal, CornerUpLeft, Trash2, Info, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getChatsStatus } from "@/app/dashboard/chat/actions";
import { useSocket } from "./socket-context";
import { toast } from "sonner";
import { useTranslation } from "@/components/i18n-provider";
import { translateValue, type Translator } from "@/lib/i18n/translate";
import { jidFromPhoneNumber } from "@/lib/chat-jid";

interface ChatContact {
    jid: string;
    name: string | null;
    notify: string | null;
    profilePic: string | null;
    lastMessage?: {
        content: string | null;
        timestamp: string;
        type: string;
    };
}

interface LabelData {
    id: string;
    name: string;
    colorHex: string;
}

interface ChatListProps {
    sessionId: string;
    onSelectChat: (jid: string, name?: string) => void;
    selectedJid?: string;
}

const PAGE_SIZE = parseInt(process.env.NEXT_PUBLIC_CHAT_PAGE_SIZE || "50", 10);

function getDisplayName(chat: ChatContact): string {
    return chat.name || chat.notify || chat.jid.split('@')[0];
}

function getMessagePreview(chat: ChatContact, t: Translator): string {
    if (!chat.lastMessage?.content) return t("chat.noMessagesYet");
    const content = chat.lastMessage.content;
    if (chat.lastMessage.type !== "TEXT") {
        return `📎 ${translateValue(t, "messageTypes", chat.lastMessage.type)}`;
    }
    return content.length > 40 ? content.slice(0, 40) + "…" : content;
}

function getTimeLabel(timestamp: string, t: Translator, locale: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return t("chat.yesterday");
    if (diffDays < 7) return date.toLocaleDateString(locale, { weekday: 'short' });
    return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

// ─── Label Assignment Popover ──────
function LabelAssignPopover({ sessionId, jid, children }: { sessionId: string; jid: string; children: React.ReactNode }) {
    const [labels, setLabels] = useState<LabelData[]>([]);
    const [assigned, setAssigned] = useState<Set<string>>(new Set());
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const openRef = useRef(false);

    const fetchLabels = useCallback(async () => {
        setLoading(true);
        try {
            const [labelRes, assignedRes] = await Promise.all([
                fetch(`/api/labels/${sessionId}`),
                fetch(`/api/labels/${sessionId}/chats?jid=${encodeURIComponent(jid)}`)
            ]);
            const labelData = await labelRes.json();
            const assignedData = await assignedRes.json();

            if (labelRes.ok) setLabels(labelData.data?.labels || []);
            if (assignedRes.ok) {
                setAssigned(new Set((assignedData.data || []).map((cl: any) => cl.labelId)));
            }
        } catch (e) {
            console.error("Failed to fetch labels", e);
        } finally {
            setLoading(false);
        }
    }, [sessionId, jid]);

    useEffect(() => {
        if (openRef.current) fetchLabels();
    }, [fetchLabels]);

    const toggleLabel = async (labelId: string) => {
        const isAssigned = assigned.has(labelId);
        try {
            const res = await fetch(`/api/labels/${sessionId}/chat/${encodeURIComponent(jid)}/labels`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ labelIds: [labelId], action: isAssigned ? "remove" : "add" })
            });
            if (res.ok) {
                setAssigned(prev => {
                    const next = new Set(prev);
                    isAssigned ? next.delete(labelId) : next.add(labelId);
                    return next;
                });
                toast.success(isAssigned ? t("chat.labelRemoved") : t("chat.labelAssigned"));
            }
        } catch (e) {
            toast.error(t("chat.labelUpdateFailed"));
        }
    };

    return (
        <Popover onOpenChange={(open) => { openRef.current = open; if (open) fetchLabels(); }}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="w-56 p-1.5" side="right" align="start">
                <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5">{t("chat.assignLabels")}</div>
                {loading ? (
                    <div className="flex items-center justify-center py-4"><Skeleton className="h-4 w-24" /></div>
                ) : labels.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-2 py-2">{t("chat.noLabels")}</p>
                ) : (
                    <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                        {labels.map(label => (
                            <button key={label.id} onClick={() => toggleLabel(label.id)}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-muted transition-colors cursor-pointer text-left">
                                <div className={cn(
                                    "h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                                    assigned.has(label.id) ? "border-foreground" : "border-muted-foreground/30"
                                )}>
                                    {assigned.has(label.id) && <Check className="h-2.5 w-2.5" />}
                                </div>
                                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: label.colorHex }} />
                                <span className="truncate text-xs font-medium">{label.name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}

// ─── Context Menu ──────────────────
interface CtxMenuState { x: number; y: number; jid: string; name: string; }
function ChatContextMenu({ state, onClose, sessionId, onSelect }: { state: CtxMenuState; onClose: () => void; sessionId: string; onSelect: (jid: string, name?: string) => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();
    useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [onClose]);

    const items = [
        { label: t("chat.openChat"), icon: MessageCircle, action: () => { onSelect(state.jid, state.name); onClose(); } },
        { label: t("chat.copyJid"), icon: Info, action: () => { navigator.clipboard.writeText(state.jid).then(() => toast.success(t("chat.jidCopied"))); onClose(); } },
    ];

    const style: React.CSSProperties = { position: "fixed", top: state.y, left: state.x, zIndex: 9999 };
    if (state.x > window.innerWidth - 180) style.left = state.x - 180;
    if (state.y > window.innerHeight - 120) style.top = state.y - 120;

    return (
        <div ref={ref} style={style} className="w-44 rounded-xl bg-popover border shadow-xl py-1 animate-in fade-in zoom-in-95 origin-top-left">
            {items.map((item, i) => (
                <button key={i} onClick={item.action} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors cursor-pointer text-foreground hover:bg-muted">
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    {item.label}
                </button>
            ))}
        </div>
    );
}

// ─── Chat Row ──────────────────────
function ChatRow({
    chat, isSelected, onSelect, sessionId, labelDots
}: {
    chat: ChatContact; isSelected: boolean; onSelect: (jid: string, name?: string) => void; sessionId: string;
    labelDots: { colorHex: string }[];
}) {
    const displayName = getDisplayName(chat);
    const { t, locale } = useTranslation();
    const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);

    return (
        <>
            {ctxMenu && (
                <ChatContextMenu state={ctxMenu} onClose={() => setCtxMenu(null)} sessionId={sessionId} onSelect={onSelect} />
            )}
            <div
                role="button"
                tabIndex={0}
                aria-current={isSelected ? "true" : undefined}
                className={cn(
                    "group relative flex w-full cursor-pointer items-center gap-3 overflow-hidden px-4 py-3 outline-none transition-colors duration-150 focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    isSelected ? "bg-accent" : "hover:bg-muted/50"
                )}
                onClick={() => onSelect(chat.jid, displayName)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(chat.jid, displayName);
                    }
                }}
                onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, jid: chat.jid, name: displayName }); }}
            >
                {isSelected && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary" aria-hidden="true" />}
                <Avatar className="size-11 shrink-0">
                    <AvatarImage src={chat.profilePic || ""} alt="" />
                    <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
                        {displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex justify-between items-baseline gap-2 overflow-hidden">
                        <h4 className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                            {displayName}
                            {/* Label dots — always visible */}
                            {labelDots.length > 0 && (
                                <span className="flex items-center gap-[2px] shrink-0">
                                    {labelDots.map((d, i) => (
                                        <span key={i} className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: d.colorHex }} title={d.colorHex} />
                                    ))}
                                </span>
                            )}
                        </h4>
                        {chat.lastMessage && (
                            <time className="shrink-0 text-xs text-muted-foreground">{getTimeLabel(chat.lastMessage.timestamp, t, locale)}</time>
                        )}
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{getMessagePreview(chat, t)}</p>
                </div>

                {/* Label button on hover */}
                <LabelAssignPopover sessionId={sessionId} jid={chat.jid}>
                    <Button variant="ghost" size="icon"
                        className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                        aria-label={t("chat.assignLabels")}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}>
                        <Tag className="size-3.5" aria-hidden="true" />
                    </Button>
                </LabelAssignPopover>
            </div>
        </>
    );
}

function SkeletonRow() {
    return (
        <div className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-40" />
            </div>
        </div>
    );
}

// ─── Main ──────────────────────────
export function ChatList({ sessionId, onSelectChat, selectedJid }: ChatListProps) {
    const [chats, setChats] = useState<ChatContact[]>([]);
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    const [newChatNumber, setNewChatNumber] = useState("");
    const [hasMore, setHasMore] = useState(true);
    // Label dots per JID — {colorHex}[]
    const [chatLabelMap, setChatLabelMap] = useState<Map<string, {colorHex: string}[]>>(new Map());

    const { getSocket, joinSession } = useSocket();
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cursorRef = useRef<string | undefined>(undefined);
    const chatsRef = useRef<ChatContact[]>(chats);
    chatsRef.current = chats;
    const fetchingRef = useRef(false);

    const fetchChats = useCallback(async (cursor?: string, append = false) => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        try {
            if (!cursor) setLoading(true);
            const rawChats: any = await getChatsStatus(sessionId, PAGE_SIZE, cursor || undefined, searchQuery || undefined);
            
            const processChats = (newChatsList: ChatContact[], existingChatsList: ChatContact[] = []) => {
                const merged = new Map(existingChatsList.map(c => [c.jid, c]));
                (newChatsList || []).forEach((c: any) => {
                    const existing = merged.get(c.jid);
                    if (!existing || (c.lastMessage?.timestamp && (!existing.lastMessage?.timestamp || new Date(c.lastMessage.timestamp) > new Date(existing.lastMessage.timestamp)))) {
                        merged.set(c.jid, c);
                    }
                });
                return Array.from(merged.values());
            };

            if (append) {
                setChats(prev => processChats(rawChats, prev));
            } else {
                setChats(processChats(rawChats));
            }
            setHasMore((rawChats || []).length >= PAGE_SIZE);
        } catch (error) {
            console.error("Failed to load chats", error);
        } finally {
            setLoading(false);
            fetchingRef.current = false;
        }
    }, [sessionId, searchQuery]);

    useEffect(() => { setChats([]); setHasMore(true); fetchChats(); }, [fetchChats]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        const onConnect = () => joinSession(sessionId);
        if (socket.connected) joinSession(sessionId);
        socket.on("connect", onConnect);
        const handler = async (newMessages: any[]) => {
            let needsReload = false;
            setChats(prev => {
                const updated = [...prev];
                newMessages.forEach(msg => {
                    const jid = msg.remoteJid;
                    const idx = updated.findIndex(c => c.jid === jid);
                    if (idx !== -1) {
                        updated[idx] = { ...updated[idx], lastMessage: { content: msg.content, timestamp: msg.timestamp, type: msg.type } };
                    } else { needsReload = true; }
                });
                updated.sort((a, b) => {
                    const tA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
                    const tB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
                    return tB - tA;
                });
                return updated;
            });
            if (needsReload) fetchChats();
        };
        socket.on("message.update", handler);
        return () => { socket.off("connect", onConnect); socket.off("message.update", handler); };
    }, [sessionId, getSocket, joinSession, fetchChats]);

    // Fetch label assignments for all chats
    useEffect(() => {
        if (!sessionId) return;
        (async () => {
            try {
                // Batch fetch all chat-label assignments in 1 call
                const res = await fetch(`/api/labels/${sessionId}/chats`);
                if (!res.ok) return;
                const data = await res.json();
                const map = new Map<string, { colorHex: string }[]>();
                for (const cl of (data.data || [])) {
                    const jid = cl.chatJid;
                    if (!map.has(jid)) map.set(jid, []);
                    map.get(jid)!.push({ colorHex: cl.colorHex });
                }
                setChatLabelMap(map);
            } catch (e) {
                console.error("Failed to load label assignments", e);
            }
        })();
    }, [sessionId]);

    const handleSearchChange = (val: string) => {
        setSearchInput(val);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            setSearchQuery(val);
        }, 300);
    };

    const filteredChats = useMemo(() => {
        if (!searchQuery.trim()) return chats;
        const q = searchQuery.toLowerCase();
        return chats.filter(chat => {
            const name = (chat.name || chat.notify || "").toLowerCase();
            const jid = chat.jid.toLowerCase();
            return name.includes(q) || jid.includes(q);
        });
    }, [chats, searchQuery]);

    const handleEndReached = useCallback(() => {
        if (hasMore && !loading && !searchQuery.trim()) {
            const last = chatsRef.current[chatsRef.current.length - 1];
            const c = last?.lastMessage?.timestamp;
            if (c) fetchChats(c, true);
        }
    }, [hasMore, loading, searchQuery, fetchChats]);

    const itemContent = useCallback(
        (_: number, chat: ChatContact) => <ChatRow key={chat.jid} chat={chat} isSelected={selectedJid === chat.jid} onSelect={onSelectChat} sessionId={sessionId} labelDots={chatLabelMap.get(chat.jid) || []} />,
        [selectedJid, onSelectChat, sessionId, chatLabelMap]
    );

    const handleStartNewChat = () => {
        if (!newChatNumber) return;
        onSelectChat(jidFromPhoneNumber(newChatNumber));
        setIsNewChatOpen(false);
        setNewChatNumber("");
    };

    if (loading && chats.length === 0) {
        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="p-3 space-y-3">
                    <Skeleton className="h-9 w-full rounded-lg" />
                    {[1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} />)}
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col overflow-hidden bg-card">
            {/* Header */}
            <div className="shrink-0 space-y-3 border-b px-4 pt-4 pb-3">
                <div className="flex justify-between items-center">
                    <h2 className="text-base font-semibold tracking-tight text-foreground">
                        {t("chat.chats")}
                        {chats.length > 0 && <span className="ml-1.5 text-sm font-normal text-muted-foreground" data-numeric>{chats.length}</span>}
                    </h2>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"
                        onClick={() => setIsNewChatOpen(!isNewChatOpen)}>
                        {isNewChatOpen ? <X className="h-4 w-4" /> : <MessageSquarePlus className="h-4 w-4" />}
                    </Button>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input placeholder={t("chat.searchChats")} value={searchInput}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="h-9 border-transparent bg-muted pl-9 text-sm dark:bg-muted" />
                </div>

                {isNewChatOpen && (
                    <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                        <Label className="text-xs font-medium text-muted-foreground">{t("chat.phoneNumber")}</Label>
                        <div className="flex gap-1.5">
                            <Input placeholder="628123456789" value={newChatNumber}
                                onChange={(e) => setNewChatNumber(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleStartNewChat()}
                                className="h-8 text-sm" />
                            <Button size="sm" className="h-8 px-3" onClick={handleStartNewChat}>{t("chat.go")}</Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Chat list */}
            <div className="flex-1 min-h-0">
                {filteredChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                            <MessageCircle className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm text-muted-foreground">{searchQuery ? t("chat.noMatch") : t("chat.noChats")}</p>
                    </div>
                ) : (
                    <Virtuoso style={{ height: "100%" }} data={filteredChats}
                        computeItemKey={(_: number, chat: ChatContact) => chat.jid} itemContent={itemContent}
                        endReached={handleEndReached} increaseViewportBy={200}
                        components={{ Footer: () => hasMore && !loading ? (
                            <div className="py-4 text-center">
                                <span className="text-xs text-muted-foreground">{t("chat.scrollMore")}</span>
                            </div>
                        ) : null }} />
                )}
            </div>
        </div>
    );
}
