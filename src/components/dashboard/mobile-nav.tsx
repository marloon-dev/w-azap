"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, ChevronDown } from "lucide-react";
import Link from "next/link";
import {
    LayoutDashboard,
    MessageSquare,
    Users,
    Settings,
    LogOut,
    QrCode,
    ImageIcon,
    Webhook,
    CalendarClock,
    Bot,
    Bell,
    FileText,
    Code,
    UserCheck,
    Megaphone,
    HardDrive,
    Activity,
    UserCircle,
    Tag,
    MessageCircleReply,
    UserPlus,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import pkg from "../../../package.json";
import { useTranslation } from "@/components/i18n-provider";
import type { TranslationKey } from "@/lib/i18n/types";

interface NavGroup {
    label: TranslationKey;
    items: { href: string; label: TranslationKey; icon: React.ElementType; external?: boolean; superadminOnly?: boolean }[];
}

// Keep in sync with sidebar-nav.tsx
const navGroups: NavGroup[] = [
    {
        label: "nav.groups.main",
        items: [
            { href: "/dashboard", label: "nav.items.dashboard", icon: LayoutDashboard },
            { href: "/dashboard/sessions", label: "nav.items.sessions", icon: QrCode },
        ],
    },
    {
        label: "nav.groups.messaging",
        items: [
            { href: "/dashboard/chat", label: "nav.items.chat", icon: MessageSquare },
            { href: "/dashboard/broadcast", label: "nav.items.broadcast", icon: Megaphone },
            { href: "/dashboard/sticker", label: "nav.items.sticker", icon: ImageIcon },
        ],
    },
    {
        label: "nav.groups.contacts",
        items: [
            { href: "/dashboard/contacts", label: "nav.items.contacts", icon: UserCheck },
            { href: "/dashboard/groups", label: "nav.items.groups", icon: Users },
            { href: "/dashboard/labels", label: "nav.items.labels", icon: Tag },
        ],
    },
    {
        label: "nav.groups.automation",
        items: [
            { href: "/dashboard/bot-settings", label: "nav.items.botSettings", icon: Bot },
            { href: "/dashboard/autoreply", label: "nav.items.autoReply", icon: MessageCircleReply },
            { href: "/dashboard/profile", label: "nav.items.botProfile", icon: UserCircle },
            { href: "/dashboard/scheduler", label: "nav.items.scheduler", icon: CalendarClock },
            { href: "/dashboard/webhooks", label: "nav.items.webhooks", icon: Webhook },
        ],
    },
    {
        label: "nav.groups.developer",
        items: [
            { href: "/docs", label: "nav.items.apiDocs", icon: FileText },
            { href: "/swagger", label: "nav.items.swagger", icon: Code, external: true },
        ],
    },
    {
        label: "nav.groups.administration",
        items: [
            { href: "/dashboard/media", label: "nav.items.media", icon: HardDrive },
            { href: "/dashboard/sessions/access", label: "nav.items.sessionAccess", icon: UserPlus },
            { href: "/dashboard/users", label: "nav.items.users", icon: Users },
            { href: "/dashboard/settings", label: "nav.items.settings", icon: Settings },
            { href: "/dashboard/system-monitor", label: "nav.items.systemMonitor", icon: Activity, superadminOnly: true },
            { href: "/dashboard/notifications", label: "nav.items.notifications", icon: Bell, superadminOnly: true },
        ],
    },
];

export function MobileNav({ appName = "W-AZAP" }: { appName?: string }) {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();
    const { data: session } = useSession();
    const { t } = useTranslation();
    // @ts-ignore
    const userRole = session?.user?.role;

    const isActive = (href: string) => {
        if (href === "/dashboard") return pathname === "/dashboard";
        return pathname.startsWith(href);
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] sm:w-[320px] p-0 flex flex-col">
                <SheetHeader className="px-5 py-4 text-left border-b border-slate-100">
                    <SheetTitle className="text-xl font-bold text-slate-800">{appName}</SheetTitle>
                    <SheetDescription className="text-[11px] text-slate-400 -mt-1">{t("common.whatsappGateway")}</SheetDescription>
                </SheetHeader>

                <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-1">
                    {navGroups.map((group) => {
                        const visibleItems = group.items.filter(
                            (item) => !item.superadminOnly || userRole === "SUPERADMIN"
                        );
                        if (visibleItems.length === 0) return null;

                        return (
                            <div key={group.label} className="mb-1">
                                {group.label !== "nav.groups.main" && (
                                    <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        {t(group.label)}
                                    </p>
                                )}
                                <div className="space-y-0.5">
                                    {visibleItems.map(({ href, label, icon: Icon, external }) => (
                                        <Link
                                            key={href}
                                            href={href}
                                            target={external ? "_blank" : undefined}
                                            onClick={() => setOpen(false)}
                                            className={`
                                                flex items-center rounded-lg text-sm font-medium
                                                transition-all duration-200 group relative
                                                gap-3 px-3 py-2
                                                ${isActive(href)
                                                    ? "text-primary bg-primary/10 shadow-sm"
                                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                                }
                                            `}
                                        >
                                            {isActive(href) && (
                                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-full" />
                                            )}
                                            <Icon
                                                size={17}
                                                className={`flex-shrink-0 transition-colors duration-200 ${isActive(href) ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"}`}
                                            />
                                            <span className="truncate">{t(label)}</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
                            {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{session?.user?.name || t("common.user")}</p>
                            <p className="text-[11px] text-slate-400 truncate">{session?.user?.email}</p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full flex items-center justify-center gap-2 text-xs h-8"
                        onClick={async () => {
                            setOpen(false);
                            await signOut({ callbackUrl: "/auth/login" });
                        }}
                    >
                        <LogOut size={14} /> {t("common.signOut")}
                    </Button>
                    <p className="text-[10px] text-slate-300 text-center mt-2 font-mono">v{pkg.version}</p>
                </div>
            </SheetContent>
        </Sheet>
    );
}
