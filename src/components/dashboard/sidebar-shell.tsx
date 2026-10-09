"use client";

import { SidebarNav } from "./sidebar-nav";
import { useSidebar } from "./sidebar-context";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTranslation } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

interface SidebarShellProps {
    appName: string;
    userName?: string | null;
    userEmail?: string | null;
    version: string;
}

export function SidebarShell({ appName, userName, userEmail, version }: SidebarShellProps) {
    const { isCollapsed } = useSidebar();
    const { t } = useTranslation();
    const initial = userName?.charAt(0)?.toUpperCase() || "U";

    return (
        <aside
            className={cn(
                "sticky top-0 left-0 z-20 hidden h-full flex-col border-r bg-sidebar transition-[width] duration-200 ease-out md:flex",
                isCollapsed ? "w-[72px]" : "w-64",
            )}
        >
            {/* Brand */}
            <div className={cn("flex h-16 shrink-0 items-center border-b", isCollapsed ? "justify-center px-3" : "gap-3 px-4")}>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">
                    {appName.charAt(0)}
                </div>
                {!isCollapsed && (
                    <div className="min-w-0">
                        <p className="truncate text-base font-semibold leading-tight text-foreground">{appName}</p>
                        <p className="truncate text-xs text-muted-foreground">{t("common.whatsappGateway")}</p>
                    </div>
                )}
            </div>

            <SidebarNav />

            {/* Account */}
            <div className={cn("shrink-0 border-t", isCollapsed ? "p-2" : "p-3")}>
                <div className={cn("flex items-center", isCollapsed ? "flex-col gap-2" : "gap-3")}>
                    <div
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                        title={isCollapsed ? `${userName || t("common.user")} · ${userEmail ?? ""}` : undefined}
                        aria-hidden="true"
                    >
                        {initial}
                    </div>
                    {!isCollapsed && (
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{userName || t("common.user")}</p>
                            <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: "/auth/login" })}
                        aria-label={t("common.signOut")}
                        title={t("common.signOut")}
                        className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                        <LogOut size={16} aria-hidden="true" />
                    </button>
                </div>
                {!isCollapsed && <p className="mt-2 text-center font-mono text-[11px] text-muted-foreground">v{version}</p>}
            </div>
        </aside>
    );
}
