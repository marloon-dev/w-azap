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
                    className={cn("h-10 gap-1.5 rounded-full px-2.5 hover:bg-muted/50", className)}
                >
                    {isChanging ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                        <Globe className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-base leading-none">{current.flag}</span>
                    <span className="hidden text-xs font-semibold uppercase sm:inline">{current.code}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-1 rounded-2xl border border-border/50 shadow-2xl glass-panel">
                <p className="px-3 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
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
                                    "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                                    selected ? "bg-primary/10 text-primary" : "hover:bg-muted/60"
                                )}
                            >
                                <span className="text-lg leading-none">{l.flag}</span>
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate font-medium">{l.name}</span>
                                    <span className="truncate text-[11px] text-muted-foreground">{l.englishName}</span>
                                </span>
                                {selected && <Check className="h-4 w-4 flex-shrink-0" />}
                            </button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}
