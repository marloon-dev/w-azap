"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
    DARK_QUERY,
    DEFAULT_THEME,
    THEME_STORAGE_KEY,
    isThemePreference,
    type ResolvedTheme,
    type ThemePreference,
} from "@/lib/theme";

interface ThemeContextValue {
    /** What the user selected (light, dark or system) */
    preference: ThemePreference;
    /** What is actually displayed right now */
    resolvedTheme: ResolvedTheme;
    setPreference: (preference: ThemePreference) => void;
    /** False until the stored preference has been read on the client */
    mounted: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredPreference(): ThemePreference {
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        return isThemePreference(stored) ? stored : DEFAULT_THEME;
    } catch {
        return DEFAULT_THEME;
    }
}

function systemTheme(): ResolvedTheme {
    return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

let transitionTimer: ReturnType<typeof setTimeout> | undefined;

function applyTheme(resolved: ResolvedTheme, preference: ThemePreference, animate: boolean) {
    const root = document.documentElement;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (animate && !reduceMotion) {
        root.classList.add("theme-transition");
        clearTimeout(transitionTimer);
        transitionTimer = setTimeout(() => root.classList.remove("theme-transition"), 250);
    }
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved;
    root.dataset.theme = preference;
    // Browser UI color (mobile address bar) follows the painted theme, not only the OS
    const color = getComputedStyle(root).getPropertyValue("--background").trim();
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", color));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    // The pre-paint script already set the class; start from the same values to avoid a mismatch
    const [preference, setPreferenceState] = useState<ThemePreference>(DEFAULT_THEME);
    const [system, setSystem] = useState<ResolvedTheme>("light");
    const [ready, setReady] = useState(false);

    useEffect(() => {
        setPreferenceState(readStoredPreference());
        setSystem(systemTheme());
        setReady(true);

        // Follow OS changes (only visible while preference is "system")
        const media = window.matchMedia(DARK_QUERY);
        const onSystemChange = (event: MediaQueryListEvent) => setSystem(event.matches ? "dark" : "light");
        media.addEventListener("change", onSystemChange);

        // Keep other open tabs in sync
        const onStorage = (event: StorageEvent) => {
            if (event.key === THEME_STORAGE_KEY) {
                setPreferenceState(isThemePreference(event.newValue) ? event.newValue : DEFAULT_THEME);
            }
        };
        window.addEventListener("storage", onStorage);

        return () => {
            media.removeEventListener("change", onSystemChange);
            window.removeEventListener("storage", onStorage);
        };
    }, []);

    const resolvedTheme: ResolvedTheme = preference === "system" ? system : preference;

    // The first apply only syncs with what the pre-paint script did, so it is not animated
    const appliedOnce = useRef(false);
    useEffect(() => {
        if (!ready) return;
        applyTheme(resolvedTheme, preference, appliedOnce.current);
        appliedOnce.current = true;
    }, [ready, resolvedTheme, preference]);

    const setPreference = useCallback((next: ThemePreference) => {
        setPreferenceState(next);
        try {
            localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
            // Storage blocked: the choice still applies for this page view
        }
    }, []);

    const value = useMemo(
        () => ({ preference, resolvedTheme, setPreference, mounted: ready }),
        [preference, resolvedTheme, setPreference, ready],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
    return ctx;
}
