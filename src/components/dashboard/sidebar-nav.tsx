"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useSidebar } from "./sidebar-context";
import { navGroups, isNavActive, visibleItems, type NavItem } from "./nav-config";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

export function SidebarNav() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const { isCollapsed, toggleCollapse } = useSidebar();
    const { t } = useTranslation();
    const userRole = session?.user?.role as string | undefined;

    // All groups expanded by default
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const toggleGroup = (label: string) => setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }));

    return (
        <TooltipProvider delayDuration={0}>
            <nav aria-label={t("common.mainNavigation")} className="styled-scrollbar flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-3 py-3">
                {navGroups.map((group) => {
                    const items = visibleItems(group, userRole);
                    if (items.length === 0) return null;
                    const isMain = group.label === "nav.groups.main";
                    const isGroupCollapsed = !isCollapsed && (collapsedGroups[group.label] ?? false);
                    const listId = `nav-group-${group.label.split(".").pop()}`;

                    return (
                        <div key={group.label}>
                            {!isMain && !isCollapsed && (
                                <button
                                    type="button"
                                    onClick={() => toggleGroup(group.label)}
                                    aria-expanded={!isGroupCollapsed}
                                    aria-controls={listId}
                                    className="mb-1 flex w-full items-center justify-between rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    {t(group.label)}
                                    <ChevronDown
                                        size={14}
                                        aria-hidden="true"
                                        className={cn("transition-transform duration-200", isGroupCollapsed && "-rotate-90")}
                                    />
                                </button>
                            )}
                            {!isMain && isCollapsed && <div className="mx-2 mb-2 border-t" aria-hidden="true" />}

                            {!isGroupCollapsed && (
                                <ul id={listId} className="space-y-0.5">
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

            <div className="border-t px-3 py-2">
                <button
                    type="button"
                    onClick={toggleCollapse}
                    aria-label={isCollapsed ? t("common.expand") : t("common.collapse")}
                    title={isCollapsed ? t("common.expand") : undefined}
                    className="flex h-9 w-full items-center justify-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                    {isCollapsed ? (
                        <PanelLeftOpen size={18} aria-hidden="true" />
                    ) : (
                        <>
                            <PanelLeftClose size={16} aria-hidden="true" />
                            <span>{t("common.collapse")}</span>
                        </>
                    )}
                </button>
            </div>
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
                "group relative flex min-h-9 items-center rounded-md text-sm font-medium transition-colors",
                isCollapsed ? "justify-center px-2 py-2" : "gap-3 px-2.5 py-2",
                active
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-foreground hover:bg-accent hover:text-foreground",
            )}
        >
            {active && !isCollapsed && (
                <span className="absolute top-1/2 -left-3 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" aria-hidden="true" />
            )}
            <Icon
                size={isCollapsed ? 20 : 18}
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
