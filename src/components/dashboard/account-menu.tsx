"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronsUpDown, ExternalLink, LogOut } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTranslation } from "@/components/i18n-provider";
import { translateValue } from "@/lib/i18n/translate";
import { developerLinks } from "./nav-config";
import { cn } from "@/lib/utils";

interface AccountMenuProps {
    userName?: string | null;
    userEmail?: string | null;
    userRole?: string | null;
    version: string;
    /** Icon-only trigger for the collapsed sidebar */
    compact?: boolean;
}

/** Who is signed in, plus the links that do not belong in the main navigation (API reference, sign out). */
export function AccountMenu({ userName, userEmail, userRole, version, compact = false }: AccountMenuProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const name = userName || t("common.user");
    const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={t("common.account")}
                    className={cn(
                        "flex w-full items-center rounded-lg text-left transition-colors hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent",
                        compact ? "justify-center p-1.5" : "gap-3 p-2",
                    )}
                >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground" aria-hidden="true">
                        {initials || "U"}
                    </span>
                    {!compact && (
                        <>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-foreground">{name}</span>
                                <span className="block truncate text-xs text-muted-foreground">{userEmail}</span>
                            </span>
                            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        </>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent side={compact ? "right" : "top"} align={compact ? "end" : "start"} sideOffset={8} className="w-64 p-1.5">
                <div className="px-2.5 pt-1.5 pb-2.5">
                    <p className="truncate text-sm font-medium text-foreground">{name}</p>
                    <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                    {userRole && <p className="mt-1.5 text-xs text-muted-foreground">{translateValue(t, "roles", userRole)}</p>}
                </div>
                <div className="border-t pt-1.5">
                    <p className="px-2.5 pb-1 text-xs font-medium text-muted-foreground">{t("nav.groups.developer")}</p>
                    {developerLinks.map(({ href, label, icon: Icon, external }) => (
                        <Link
                            key={href}
                            href={href}
                            target={external ? "_blank" : undefined}
                            rel={external ? "noopener noreferrer" : undefined}
                            onClick={() => setOpen(false)}
                            className="flex min-h-9 items-center gap-2.5 rounded-md px-2.5 text-sm text-foreground transition-colors hover:bg-accent"
                        >
                            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                            <span className="flex-1">{t(label)}</span>
                            {external && <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />}
                        </Link>
                    ))}
                </div>
                <div className="mt-1.5 border-t pt-1.5">
                    <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: "/auth/login" })}
                        className="flex min-h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
                    >
                        <LogOut className="size-4" aria-hidden="true" />
                        {t("common.signOut")}
                    </button>
                </div>
                <p className="px-2.5 pt-2 pb-1 text-xs text-muted-foreground" data-numeric>
                    {t("common.version", { version })}
                </p>
            </PopoverContent>
        </Popover>
    );
}
