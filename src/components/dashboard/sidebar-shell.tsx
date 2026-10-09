"use client";

import Link from "next/link";
import { SidebarNav } from "./sidebar-nav";
import { SessionSelector } from "./session-selector";
import { AccountMenu } from "./account-menu";
import { useSidebar } from "./sidebar-context";
import { BrandMark } from "@/components/brand-mark";
import { useTranslation } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

interface SidebarShellProps {
    appName: string;
    userName?: string | null;
    userEmail?: string | null;
    userRole?: string | null;
    version: string;
}

export function SidebarShell({ appName, userName, userEmail, userRole, version }: SidebarShellProps) {
    const { isCollapsed } = useSidebar();
    const { t } = useTranslation();

    return (
        <aside
            className={cn(
                "sticky top-0 left-0 z-20 hidden h-full flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out md:flex",
                isCollapsed ? "w-[72px]" : "w-64",
            )}
        >
            {/* Brand */}
            <Link
                href="/dashboard"
                className={cn("flex h-16 shrink-0 items-center", isCollapsed ? "justify-center px-3" : "gap-3 px-4")}
                aria-label={isCollapsed ? appName : undefined}
            >
                <BrandMark className="size-8" />
                {!isCollapsed && (
                    <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold leading-tight tracking-tight text-foreground">{appName}</span>
                        <span className="block truncate text-xs text-muted-foreground">{t("common.whatsappGateway")}</span>
                    </span>
                )}
            </Link>

            {/* The session every page acts on */}
            {!isCollapsed && (
                <div className="shrink-0 px-3 pb-1">
                    <SessionSelector variant="sidebar" />
                </div>
            )}

            <SidebarNav />

            <div className={cn("shrink-0 border-t border-sidebar-border", isCollapsed ? "p-2" : "p-2.5")}>
                <AccountMenu userName={userName} userEmail={userEmail} userRole={userRole} version={version} compact={isCollapsed} />
            </div>
        </aside>
    );
}
