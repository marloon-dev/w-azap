"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronDown } from "lucide-react";
import { useSidebar } from "./sidebar-context";
import { navGroups, isNavActive, visibleItems, foldedByDefault, type NavItem } from "./nav-config";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

export function SidebarNav() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const { isCollapsed } = useSidebar();
    const { t } = useTranslation();
    const userRole = session?.user?.role as string | undefined;

    // Only the groups the user folds (or the administration group) start closed
    const [foldedGroups, setFoldedGroups] = useState<Record<string, boolean>>({});
    const toggleGroup = (label: string, folded: boolean) => setFoldedGroups((prev) => ({ ...prev, [label]: !folded }));

    return (
        <TooltipProvider delayDuration={0}>
            <nav aria-label={t("common.mainNavigation")} className="styled-scrollbar flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-3 py-4">
                {navGroups.map((group) => {
                    const items = visibleItems(group, userRole);
                    if (items.length === 0) return null;
                    const isMain = group.label === "nav.groups.main";
                    const hasActive = items.some((item) => isNavActive(pathname, item.href));
                    const folded = foldedGroups[group.label] ?? (foldedByDefault.has(group.label) && !hasActive);
                    const isGroupFolded = !isCollapsed && folded;
                    const listId = `nav-group-${group.label.split(".").pop()}`;

                    return (
                        <div key={group.label}>
                            {!isMain && !isCollapsed && (
                                <button
                                    type="button"
                                    onClick={() => toggleGroup(group.label, folded)}
                                    aria-expanded={!isGroupFolded}
                                    aria-controls={listId}
                                    className="group/heading mb-1 flex w-full items-center justify-between rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    {t(group.label)}
                                    <ChevronDown
                                        size={14}
                                        aria-hidden="true"
                                        className={cn("opacity-60 transition-transform duration-200 group-hover/heading:opacity-100", isGroupFolded && "-rotate-90")}
                                    />
                                </button>
                            )}
                            {!isMain && isCollapsed && <div className="mx-2 mb-3 border-t" aria-hidden="true" />}

                            {!isGroupFolded && (
                                <ul id={listId} className="space-y-px">
                                    {items.map((item) => (
                                        <li key={item.href}>
                                            <NavLink item={item} active={isNavActive(pathname, item.href)} isCollapsed={isCollapsed} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </nav>
        </TooltipProvider>
    );
}

function NavLink({ item, active, isCollapsed }: { item: NavItem; active: boolean; isCollapsed: boolean }) {
    const Icon = item.icon;
    const { t } = useTranslation();
    const label = t(item.label);

    const link = (
        <Link
            href={item.href}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noopener noreferrer" : undefined}
            aria-current={active ? "page" : undefined}
            aria-label={isCollapsed ? label : undefined}
            className={cn(
                "group relative flex min-h-9 items-center rounded-md text-sm transition-colors",
                isCollapsed ? "justify-center px-2 py-2" : "gap-3 px-2.5 py-1.5",
                active
                    ? "bg-sidebar-accent font-medium text-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
            )}
        >
            {active && (
                <span
                    className={cn("absolute top-1/2 w-[3px] -translate-y-1/2 rounded-full bg-primary", isCollapsed ? "-left-3 h-5" : "-left-3 h-4")}
                    aria-hidden="true"
                />
            )}
            <Icon
                size={isCollapsed ? 20 : 17}
                strokeWidth={active ? 2.2 : 1.8}
                aria-hidden="true"
                className={cn("shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")}
            />
            {!isCollapsed && <span className="truncate">{label}</span>}
        </Link>
    );

    if (!isCollapsed) return link;
    return (
        <Tooltip>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
                {label}
            </TooltipContent>
        </Tooltip>
    );
}
