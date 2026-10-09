import en from "./dictionaries/en";
import type { Dictionary, TranslationKey, TranslationVars } from "./types";

function lookup(dict: Dictionary, key: string): string | undefined {
    let node: unknown = dict;
    for (const part of key.split(".")) {
        if (node == null || typeof node !== "object") return undefined;
        node = (node as Record<string, unknown>)[part];
    }
    return typeof node === "string" ? node : undefined;
}

/** Build a `t()` for a dictionary. Falls back to English, then to the key itself; replaces `{var}` placeholders. */
export function createTranslator(dict: Dictionary) {
    return function t(key: TranslationKey, vars?: TranslationVars): string {
        const template = lookup(dict, key) ?? lookup(en, key) ?? key;
        if (!vars) return template;
        return template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
    };
}

export type Translator = ReturnType<typeof createTranslator>;

/** Translate a dynamic value (e.g. a status enum) under `prefix`, falling back to the raw value when no key exists. */
export function translateValue(t: Translator, prefix: string, value: string | null | undefined): string {
    if (!value) return "";
    const key = `${prefix}.${value}` as TranslationKey;
    const result = t(key);
    return result === key ? value : result;
}
