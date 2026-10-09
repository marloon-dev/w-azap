import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, isLocale, matchLocale, type Locale } from "./config";
import { loadDictionary } from "./dictionaries";
import { createTranslator } from "./translate";

/** Locale from the user's cookie, otherwise negotiated from the browser's Accept-Language header. */
export async function getLocale(): Promise<Locale> {
    const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (isLocale(cookieLocale)) return cookieLocale;
    return matchLocale((await headers()).get("accept-language"));
}

/** `t()` for Server Components. */
export async function getTranslations() {
    const locale = await getLocale();
    const dictionary = await loadDictionary(locale);
    return { locale, dictionary, t: createTranslator(dictionary) };
}
