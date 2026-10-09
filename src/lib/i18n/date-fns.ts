import { ar, de, enUS, es, fr, hi, id, it, ja, ko, ptBR, ru, tr, zhCN, type Locale as DateFnsLocale } from "date-fns/locale";
import type { Locale } from "./config";

const map: Record<Locale, DateFnsLocale> = {
    en: enUS,
    "pt-BR": ptBR,
    es,
    fr,
    de,
    it,
    ru,
    "zh-CN": zhCN,
    ja,
    ko,
    ar,
    hi,
    id,
    tr,
};

/** date-fns locale for relative times like "5 minutes ago". */
export function dateFnsLocale(locale: Locale): DateFnsLocale {
    return map[locale];
}
