"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTranslation } from "@/components/i18n-provider";

interface AuthShellProps {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    children: React.ReactNode;
    /** Line under the form (e.g. "No account? Create one") */
    footer?: React.ReactNode;
}

/** Sign-in pages: the form on a quiet column, the product statement on a green panel (desktop only). */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
    const { t } = useTranslation();

    return (
        <div className="grid min-h-dvh bg-background lg:grid-cols-[1fr_minmax(0,40rem)]">
            <div className="flex min-h-dvh flex-col px-4 sm:px-8">
                <header className="flex h-16 items-center justify-between">
                    <Link href="/" className="flex items-center gap-2.5 rounded-md">
                        <BrandMark className="size-8" />
                        <span className="text-[15px] font-semibold tracking-tight text-foreground">W-AZAP</span>
                    </Link>
                    <div className="flex items-center gap-1">
                        <LanguageSwitcher />
                        <ThemeToggle />
                    </div>
                </header>

                <main className="flex flex-1 items-center justify-center py-10">
                    <div className="w-full max-w-sm">
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
                        {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
                        <div className="mt-8">{children}</div>
                        {footer && <p className="mt-8 text-sm text-muted-foreground">{footer}</p>}
                    </div>
                </main>
            </div>

            <aside className="relative hidden flex-col justify-end overflow-hidden bg-primary p-12 text-primary-foreground dark:bg-[#0b3a2a] dark:text-[#e4f5ec] lg:flex">
                {/* The brand's three bars, drawn large as a quiet backdrop */}
                <svg viewBox="0 0 24 24" className="absolute -top-10 -right-16 size-[30rem] opacity-[0.09]" fill="currentColor" aria-hidden="true">
                    <rect x="3" y="14" width="4.5" height="7" rx="1.5" />
                    <rect x="9.75" y="9" width="4.5" height="12" rx="1.5" />
                    <rect x="16.5" y="3" width="4.5" height="18" rx="1.5" />
                </svg>
                <p className="font-condensed relative max-w-md text-6xl font-semibold leading-[0.95] tracking-[-0.025em]">
                    {t("landing.heroLine1")} {t("landing.heroLine2")}
                </p>
                <p className="relative mt-6 max-w-sm text-base leading-relaxed opacity-85">{t("landing.heroDescription")}</p>
            </aside>
        </div>
    );
}
