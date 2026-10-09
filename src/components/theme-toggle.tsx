"use client";

import { useId, useState } from "react";
import { Check, Monitor, Moon, Sun, SunMoon, type LucideIcon } from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme } from "@/components/theme-provider";
import { useTranslation } from "@/components/i18n-provider";
import { THEME_PREFERENCES, isThemePreference, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const ICONS: Record<ThemePreference, LucideIcon> = {
    light: Sun,
    dark: Moon,
    system: Monitor,
};

/**
 * Theme picker: a compact icon button that opens a three-option radio group
 * (Light / Dark / Automatic). Arrow keys move between options, Esc closes.
 */
export function ThemeToggle({ className }: { className?: string }) {
    const { preference, resolvedTheme, setPreference, mounted } = useTheme();
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const labelId = useId();

    const label = (p: ThemePreference) => t(`theme.${p}`);
    const TriggerIcon = mounted ? ICONS[preference] : SunMoon;
    const currentText = mounted
        ? preference === "system"
            ? `${label("system")} · ${label(resolvedTheme)}`
            : label(preference)
        : "";
    const triggerName = mounted ? `${t("theme.toggle")} (${t("theme.current", { theme: currentText })})` : t("theme.toggle");

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={triggerName}
                    title={triggerName}
                    className={cn("size-9 text-muted-foreground hover:text-foreground", className)}
                >
                    <TriggerIcon className="size-[18px]" aria-hidden="true" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-1.5">
                <p id={labelId} className="px-2.5 pt-1.5 pb-2 text-xs font-medium text-muted-foreground">
                    {t("theme.label")}
                </p>
                <RadioGroupPrimitive.Root
                    aria-labelledby={labelId}
                    value={preference}
                    onValueChange={(value) => {
                        if (isThemePreference(value)) setPreference(value);
                    }}
                    className="grid gap-0.5"
                >
                    {THEME_PREFERENCES.map((p) => {
                        const Icon = ICONS[p];
                        const selected = mounted && preference === p;
                        return (
                            <RadioGroupPrimitive.Item
                                key={p}
                                value={p}
                                className={cn(
                                    "flex min-h-10 w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm outline-none transition-colors",
                                    "hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                                    selected && "bg-primary/10 text-primary hover:bg-primary/15",
                                )}
                            >
                                <Icon className="size-4 shrink-0" aria-hidden="true" />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="font-medium">{label(p)}</span>
                                    {p === "system" && mounted && (
                                        <span className={cn("text-xs", selected ? "text-primary/80" : "text-muted-foreground")}>
                                            {t("theme.systemHint", { theme: label(resolvedTheme).toLowerCase() })}
                                        </span>
                                    )}
                                </span>
                                <RadioGroupPrimitive.Indicator asChild>
                                    <Check className="size-4 shrink-0" aria-hidden="true" />
                                </RadioGroupPrimitive.Indicator>
                            </RadioGroupPrimitive.Item>
                        );
                    })}
                </RadioGroupPrimitive.Root>
            </PopoverContent>
        </Popover>
    );
}
