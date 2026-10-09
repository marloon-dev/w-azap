import type { Locale } from "../config";
import type { Dictionary } from "../types";

// Lazy loaders so each locale is its own chunk; only the active one is downloaded.
const loaders: Record<Locale, () => Promise<{ default: Dictionary }>> = {
    en: () => import("./en"),
    "pt-BR": () => import("./pt-BR"),
    es: () => import("./es"),
    fr: () => import("./fr"),
    de: () => import("./de"),
    it: () => import("./it"),
    ru: () => import("./ru"),
    "zh-CN": () => import("./zh-CN"),
    ja: () => import("./ja"),
    ko: () => import("./ko"),
    ar: () => import("./ar"),
    hi: () => import("./hi"),
    id: () => import("./id"),
    tr: () => import("./tr"),
};

export async function loadDictionary(locale: Locale): Promise<Dictionary> {
    return (await loaders[locale]()).default;
}
