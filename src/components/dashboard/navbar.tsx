"use client";

import { useState, useEffect } from "react";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { SessionSelector } from "@/components/dashboard/session-selector";
import { Button } from "@/components/ui/button";
import { RealtimeClock } from "@/components/dashboard/realtime-clock";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, Inbox, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/components/i18n-provider";
import { dateFnsLocale } from "@/lib/i18n/date-fns";

interface NavbarProps {
    appName?: string;
}

interface Notification {
    id: string;
    title: string;
    message: string;
    type: string;
    read: boolean;
    href?: string;
    createdAt: string;
}

export function Navbar({ appName }: NavbarProps) {
    const router = useRouter();
    const { data: session } = useSession();
    const { t, locale } = useTranslation();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [socket, setSocket] = useState<Socket | null>(null);

    const fetchNotifications = async () => {
        try {
            const res = await fetch("/api/notifications");
            if (res.ok) {
                const responseData = await res.json();
                const items = responseData?.data || [];
                setNotifications(items);
                setUnreadCount(items.filter((n: Notification) => !n.read).length);
            }
        } catch (e) {
            console.error("Failed to fetch notifications");
        }
    };

    useEffect(() => {
        // Initial fetch
        fetchNotifications();

        // Setup Socket.IO connection
        if (session?.user?.id) {
            const socketInstance = io({
                path: "/api/socket/io",
            });

            socketInstance.on("connect", () => {
                console.log("Socket connected for notifications");
                // Join user-specific room
                socketInstance.emit("join-user-room", session.user.id);
            });

            socketInstance.on("notification:new", (notification: Notification) => {
                console.log("New notification received:", notification);

                // Add to notifications list
                setNotifications(prev => [notification, ...prev]);
                setUnreadCount(prev => prev + 1);

                // Show toast popup
                toast.info(notification.title, {
                    description: notification.message,
                    action: notification.href ? {
                        label: t("common.view"),
                        onClick: () => router.push(notification.href!)
                    } : undefined,
                });
            });

            setSocket(socketInstance);

            return () => {
                socketInstance.disconnect();
            };
        }
    }, [session?.user?.id]);

    const markAsRead = async (id?: string) => {
        try {
            const ids = id ? [id] : []; // Empty array means mark all
            const res = await fetch("/api/notifications/read", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids })
            });
            if (res.ok) {
                if (id) {
                    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
                    setUnreadCount(prev => Math.max(0, prev - 1));
                } else {
                    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                    setUnreadCount(0);
                }
            }
        } catch (e) {
            console.error("Failed to mark read");
        }
    };

    const deleteNotification = async (id: string) => {
        try {
            const res = await fetch(`/api/notifications/delete?id=${id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                setNotifications(prev => prev.filter(n => n.id !== id));
                setUnreadCount(prev => {
                    const notification = notifications.find(n => n.id === id);
                    return notification && !notification.read ? Math.max(0, prev - 1) : prev;
                });
                toast.success(t("notifications.deleted"));
            }
        } catch (e) {
            console.error("Failed to delete notification");
            toast.error(t("notifications.deleteFailed"));
        }
    };

    const handleNotificationClick = (n: Notification) => {
        if (!n.read) markAsRead(n.id);
        if (n.href) router.push(n.href);
        setIsOpen(false);
    };

    const bellLabel = unreadCount > 0
        ? `${t("notifications.title")}: ${t("notifications.unread", { count: unreadCount })}`
        : t("notifications.title");

    return (
        <header className="sticky top-0 z-30 flex h-16 w-full shrink-0 items-center justify-between gap-2 border-b bg-background/85 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-6">
            <div className="flex items-center">
                <MobileNav appName={appName} />
            </div>

            <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                <span className="hidden lg:inline"><RealtimeClock /></span>
                <SessionSelector />
                <div className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />

                <LanguageSwitcher />
                <ThemeToggle />

                <Popover open={isOpen} onOpenChange={setIsOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={bellLabel}
                            title={bellLabel}
                            className="relative size-10 rounded-full text-muted-foreground hover:text-foreground"
                        >
                            <Bell className={cn("size-5", unreadCount > 0 && "text-primary")} aria-hidden="true" />
                            {unreadCount > 0 && (
                                <span className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground ring-2 ring-background" aria-hidden="true">
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(22rem,calc(100vw-1.5rem))] p-0" align="end">
                        <div className="flex items-start justify-between gap-2 border-b p-4">
                            <div>
                                <h2 className="text-sm font-semibold leading-none text-foreground">{t("notifications.title")}</h2>
                                <p className="mt-1.5 text-xs text-muted-foreground">
                                    {unreadCount > 0 ? t("notifications.unread", { count: unreadCount }) : t("notifications.none")}
                                </p>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { router.push("/dashboard/inbox"); setIsOpen(false); }}>
                                    {t("notifications.seeAll")}
                                </Button>
                                {unreadCount > 0 && (
                                    <Button variant="ghost" size="sm" onClick={() => markAsRead()} className="h-8 px-2 text-xs">
                                        {t("notifications.markAllRead")}
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="styled-scrollbar max-h-[min(22rem,60vh)] overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="flex min-h-[150px] flex-col items-center justify-center p-4 text-center">
                                    <div className="mb-3 rounded-full bg-muted p-3">
                                        <Inbox className="size-6 text-muted-foreground" aria-hidden="true" />
                                    </div>
                                    <p className="text-sm font-medium">{t("notifications.emptyTitle")}</p>
                                    <p className="max-w-[200px] text-xs text-muted-foreground">{t("notifications.emptyDescription")}</p>
                                </div>
                            ) : (
                                <ul className="divide-y">
                                    {notifications.map(n => (
                                        <li key={n.id} className={cn("flex items-start gap-2 p-3 transition-colors hover:bg-muted/50", !n.read && "bg-primary/5")}>
                                            <button
                                                type="button"
                                                className="min-w-0 flex-1 space-y-1 rounded-md p-1 text-left"
                                                onClick={() => handleNotificationClick(n)}
                                            >
                                                <span className="flex items-center gap-2">
                                                    {!n.read && <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
                                                    <span className={cn("text-sm leading-snug", n.read ? "font-medium text-foreground" : "font-semibold text-foreground")}>
                                                        {n.title}
                                                    </span>
                                                </span>
                                                <span className="block whitespace-normal break-words text-xs text-muted-foreground">{n.message}</span>
                                                <span className="block text-xs text-muted-foreground">
                                                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: dateFnsLocale(locale) })}
                                                </span>
                                            </button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                                aria-label={t("ui.delete")}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteNotification(n.id);
                                                }}
                                            >
                                                <Trash2 className="size-4" aria-hidden="true" />
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </header>
    );
}
