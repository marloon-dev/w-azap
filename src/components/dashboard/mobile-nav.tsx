"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/components/i18n-provider";
import { navGroups, isNavActive, visibleItems } from "./nav-config";
import { AccountMenu } from "./account-menu";
import { BrandMark } from "@/components/brand-mark";
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
                <Button variant="ghost" size="icon" className="size-9 md:hidden" aria-label={t("common.openMenu")}>
                    <Menu className="size-5" aria-hidden="true" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-[85vw] max-w-[320px] flex-col gap-0 bg-sidebar p-0">
                <SheetHeader className="flex-row items-center gap-3 border-b border-sidebar-border px-4 py-3 text-left">
                    <BrandMark className="size-8" />
                    <div className="min-w-0">
                        <SheetTitle className="truncate text-base font-semibold">{appName}</SheetTitle>
                        <SheetDescription className="truncate text-xs">{t("common.whatsappGateway")}</SheetDescription>
                    </div>
                </SheetHeader>

                <nav aria-label={t("common.mainNavigation")} className="styled-scrollbar flex-1 space-y-5 overflow-y-auto px-3 py-4">
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
                                                        active ? "bg-sidebar-accent text-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
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

                <div className="border-t border-sidebar-border p-2.5">
                    <AccountMenu
                        userName={session?.user?.name}
                        userEmail={session?.user?.email}
                        userRole={userRole}
                        version={pkg.version}
                    />
                </div>
            </SheetContent>
        </Sheet>
    );
}
