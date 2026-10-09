export const LOCALE_COOKIE = "NEXT_LOCALE";
export const DEFAULT_LOCALE = "en";

export const LOCALES = [
    { code: "en", name: "English", englishName: "English", flag: "🇺🇸" },
    { code: "pt-BR", name: "Português (Brasil)", englishName: "Portuguese (Brazil)", flag: "🇧🇷" },
    { code: "es", name: "Español", englishName: "Spanish", flag: "🇪🇸" },
    { code: "fr", name: "Français", englishName: "French", flag: "🇫🇷" },
    { code: "de", name: "Deutsch", englishName: "German", flag: "🇩🇪" },
    { code: "it", name: "Italiano", englishName: "Italian", flag: "🇮🇹" },
    { code: "ru", name: "Русский", englishName: "Russian", flag: "🇷🇺" },
    { code: "zh-CN", name: "简体中文", englishName: "Chinese (Simplified)", flag: "🇨🇳" },
    { code: "ja", name: "日本語", englishName: "Japanese", flag: "🇯🇵" },
    { code: "ko", name: "한국어", englishName: "Korean", flag: "🇰🇷" },
    { code: "ar", name: "العربية", englishName: "Arabic", flag: "🇸🇦" },
    { code: "hi", name: "हिन्दी", englishName: "Hindi", flag: "🇮🇳" },
    { code: "id", name: "Bahasa Indonesia", englishName: "Indonesian", flag: "🇮🇩" },
    { code: "tr", name: "Türkçe", englishName: "Turkish", flag: "🇹🇷" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

export function isLocale(value: unknown): value is Locale {
    return typeof value === "string" && LOCALES.some((l) => l.code === value);
}

/**
 * Resolve a locale from an Accept-Language header value.
 * Exact matches win ("pt-BR"), then base-language matches ("pt-PT" -> "pt-BR", "zh-TW" -> "zh-CN").
 */
export function matchLocale(acceptLanguage: string | null | undefined): Locale {
    if (!acceptLanguage) return DEFAULT_LOCALE;

    const requested = acceptLanguage
        .split(",")
        .map((part) => {
            const [tag, q] = part.trim().split(";q=");
            return { tag: tag.toLowerCase(), q: q ? parseFloat(q) : 1 };
        })
        .filter((r) => r.tag && r.tag !== "*")
        .sort((a, b) => b.q - a.q);

    for (const { tag } of requested) {
        const exact = LOCALES.find((l) => l.code.toLowerCase() === tag);
        if (exact) return exact.code;
        const base = tag.split("-")[0];
        const partial = LOCALES.find((l) => l.code.toLowerCase().split("-")[0] === base);
        if (partial) return partial.code;
    }

    return DEFAULT_LOCALE;
}
