/**
 * Theme preference shared by the provider, the toggle and the pre-paint script.
 *
 * - "preference" is what the user chose: light | dark | system (default)
 * - "resolved" is what is actually painted: light | dark
 */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_PREFERENCES: ThemePreference[] = ["light", "dark", "system"];
export const THEME_STORAGE_KEY = "w-azap-theme";
export const DEFAULT_THEME: ThemePreference = "system";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

export function isThemePreference(value: unknown): value is ThemePreference {
    return value === "light" || value === "dark" || value === "system";
}

/**
 * Inline script run in <head> before first paint, so the page never flashes the wrong theme.
 * Kept dependency-free and wrapped in try/catch (storage can be blocked in private mode).
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(p!=="light"&&p!=="dark"&&p!=="system")p=${JSON.stringify(DEFAULT_THEME)};var d=p==="dark"||(p==="system"&&window.matchMedia(${JSON.stringify(DARK_QUERY)}).matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";r.dataset.theme=p;}catch(e){}})();`;
