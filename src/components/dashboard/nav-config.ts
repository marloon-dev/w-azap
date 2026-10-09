import {
    Activity,
    Bell,
    Bot,
    CalendarClock,
    Code,
    FileText,
    HardDrive,
    ImageIcon,
    LayoutDashboard,
    Megaphone,
    MessageCircleReply,
    MessageSquare,
    QrCode,
    Settings,
    Tag,
    UserCheck,
    UserCircle,
    UserPlus,
    Users,
    Webhook,
    type LucideIcon,
} from "lucide-react";
import type { TranslationKey } from "@/lib/i18n/types";

export interface NavItem {
    href: string;
    label: TranslationKey;
    icon: LucideIcon;
    external?: boolean;
    superadminOnly?: boolean;
}

export interface NavGroup {
    label: TranslationKey;
    items: NavItem[];
}

/** Single source of truth for the desktop sidebar and the mobile drawer. */
export const navGroups: NavGroup[] = [
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
            { href: "/dashboard/users", label: "nav.items.users", icon: Users, superadminOnly: true },
            { href: "/dashboard/settings", label: "nav.items.settings", icon: Settings },
            { href: "/dashboard/system-monitor", label: "nav.items.systemMonitor", icon: Activity, superadminOnly: true },
            { href: "/dashboard/notifications", label: "nav.items.notifications", icon: Bell, superadminOnly: true },
        ],
    },
];

const allHrefs = navGroups.flatMap((group) => group.items.map((item) => item.href));

/** Active = exact match or a sub-page, unless a more specific menu item matches (sessions vs sessions/access). */
export function isNavActive(pathname: string, href: string): boolean {
    const matches = (h: string) => pathname === h || (h !== "/dashboard" && pathname.startsWith(h + "/"));
    if (!matches(href)) return false;
    return !allHrefs.some((other) => other.length > href.length && other.startsWith(href) && matches(other));
}

export function visibleItems(group: NavGroup, role?: string): NavItem[] {
    return group.items.filter((item) => !item.superadminOnly || role === "SUPERADMIN");
}
