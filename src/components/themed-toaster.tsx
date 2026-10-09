"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/components/theme-provider";

/** Sonner toasts that follow the app theme (light/dark), with readable rich colors in both. */
export function ThemedToaster() {
    const { resolvedTheme } = useTheme();
    return <Toaster theme={resolvedTheme} richColors closeButton position="bottom-right" />;
}
