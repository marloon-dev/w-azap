"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { loadDictionary } from "@/lib/i18n/dictionaries";
import { createTranslator, type Translator } from "@/lib/i18n/translate";
import type { Dictionary } from "@/lib/i18n/types";

interface I18nContextValue {
    locale: Locale;
    t: Translator;
    setLocale: (locale: Locale) => Promise<void>;
    isChanging: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
    initialLocale,
    initialDictionary,
    children,
}: {
    initialLocale: Locale;
    initialDictionary: Dictionary;
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [locale, setLocaleState] = useState<Locale>(initialLocale);
    const [dictionary, setDictionary] = useState<Dictionary>(initialDictionary);
    const [isPending, startTransition] = useTransition();

    const setLocale = useCallback(async (next: Locale) => {
        const nextDictionary = await loadDictionary(next);
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        document.documentElement.lang = next;
        setDictionary(nextDictionary);
        setLocaleState(next);
        // Re-render Server Components (landing page, metadata) with the new cookie
        startTransition(() => router.refresh());
    }, [router]);

    const value = useMemo<I18nContextValue>(() => ({
        locale,
        t: createTranslator(dictionary),
        setLocale,
        isChanging: isPending,
    }), [locale, dictionary, setLocale, isPending]);

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
    const ctx = useContext(I18nContext);
    if (!ctx) throw new Error("useTranslation must be used within I18nProvider");
    return ctx;
}
