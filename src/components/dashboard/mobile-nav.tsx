"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LogOut, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/components/i18n-provider";
import { navGroups, isNavActive, visibleItems } from "./nav-config";
import { cn } from "@/lib/utils";
import pkg from "../../../package.json";

export function MobileNav({ appName = "W-AZAP" }: { appName?: string }) {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();
    const { data: session } = useSession();
    const { t } = useTranslation();
    const userRole = session?.user?.role as string | undefined;

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="size-10 md:hidden" aria-label={t("common.openMenu")}>
                    <Menu className="size-5" aria-hidden="true" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-[85vw] max-w-[320px] flex-col gap-0 bg-sidebar p-0">
                <SheetHeader className="flex-row items-center gap-3 border-b px-4 py-3 text-left">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">
                        {appName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                        <SheetTitle className="truncate text-base font-semibold">{appName}</SheetTitle>
                        <SheetDescription className="truncate text-xs">{t("common.whatsappGateway")}</SheetDescription>
                    </div>
                </SheetHeader>

                <nav aria-label={t("common.mainNavigation")} className="styled-scrollbar flex-1 space-y-4 overflow-y-auto px-3 py-3">
                    {navGroups.map((group) => {
                        const items = visibleItems(group, userRole);
                        if (items.length === 0) return null;
                        return (
                            <div key={group.label}>
                                {group.label !== "nav.groups.main" && (
                                    <p className="mb-1 px-2.5 text-xs font-medium text-muted-foreground">{t(group.label)}</p>
                                )}
                                <ul className="space-y-0.5">
                                    {items.map(({ href, label, icon: Icon, external }) => {
                                        const active = isNavActive(pathname, href);
                                        return (
                                            <li key={href}>
                                                <Link
                                                    href={href}
                                                    target={external ? "_blank" : undefined}
                                                    rel={external ? "noopener noreferrer" : undefined}
                                                    aria-current={active ? "page" : undefined}
                                                    onClick={() => setOpen(false)}
                                                    className={cn(
                                                        "flex min-h-11 items-center gap-3 rounded-md px-2.5 text-sm font-medium transition-colors",
                                                        active ? "bg-primary/10 text-primary" : "text-sidebar-foreground hover:bg-accent hover:text-foreground",
                                                    )}
                                                >
                                                    <Icon size={18} aria-hidden="true" className={cn("shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                                                    <span className="truncate">{t(label)}</span>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}
                </nav>

                <div className="border-t p-3">
                    <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden="true">
                            {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{session?.user?.name || t("common.user")}</p>
                            <p className="truncate text-xs text-muted-foreground">{session?.user?.email}</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-10 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label={t("common.signOut")}
                            onClick={async () => {
                                setOpen(false);
                                await signOut({ callbackUrl: "/auth/login" });
                            }}
                        >
                            <LogOut className="size-4" aria-hidden="true" />
                        </Button>
                    </div>
                    <p className="mt-2 text-center font-mono text-[11px] text-muted-foreground">v{pkg.version}</p>
                </div>
            </SheetContent>
        </Sheet>
    );
}
