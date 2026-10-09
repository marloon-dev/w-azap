"use client";

import { useState } from "react";
import { Check, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTranslation } from "@/components/i18n-provider";
import { LOCALES } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
    const { locale, setLocale, isChanging, t } = useTranslation();
    const [open, setOpen] = useState(false);
    const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t("language.select")}
                    title={t("language.select")}
                    className={cn("h-9 gap-1.5 px-2.5 text-muted-foreground hover:text-foreground", className)}
                >
                    {isChanging ? (
                        <Loader2 className="size-[18px] animate-spin" />
                    ) : (
                        <Globe className="size-[18px]" />
                    )}
                    <span className="hidden text-xs font-medium sm:inline">{current.code}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-1.5">
                <p className="px-2.5 pt-1.5 pb-2 text-xs font-medium text-muted-foreground">
                    {t("language.label")}
                </p>
                <div className="max-h-[340px] overflow-y-auto styled-scrollbar">
                    {LOCALES.map((l) => {
                        const selected = l.code === locale;
                        return (
                            <button
                                key={l.code}
                                type="button"
                                lang={l.code}
                                onClick={async () => {
                                    setOpen(false);
                                    if (!selected) await setLocale(l.code);
                                }}
                                className={cn(
                                    "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                                    selected ? "bg-accent text-foreground" : "hover:bg-accent/70"
                                )}
                            >
                                <span className="text-lg leading-none">{l.flag}</span>
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate font-medium">{l.name}</span>
                                    <span className="truncate text-[11px] text-muted-foreground">{l.englishName}</span>
                                </span>
                                {selected && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
                            </button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}
