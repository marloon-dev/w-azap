import type en from "./dictionaries/en";

type DeepStringify<T> = { [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]> };

export type Dictionary = DeepStringify<typeof en>;

type Join<K extends string, P extends string> = `${K}.${P}`;

/** Dot-notation keys of every leaf string, e.g. "nav.items.chat". */
export type TranslationKey<T = Dictionary> = {
    [K in keyof T & string]: T[K] extends string ? K : Join<K, TranslationKey<T[K]>>;
}[keyof T & string];

export type TranslationVars = Record<string, string | number>;

export type DashboardDictionary = DeepStringify<typeof import("./dictionaries/dashboard/en").default>;
