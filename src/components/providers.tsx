"use client";

import { SessionProvider } from "next-auth/react";
import { SocketProvider } from "@/components/chat/socket-context";
import { I18nProvider } from "@/components/i18n-provider";
import { ThemeProvider } from "@/components/theme-provider";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/types";

export function Providers({ children, locale, dictionary }: { children: React.ReactNode; locale: Locale; dictionary: Dictionary }) {
  return (
    <ThemeProvider>
      <I18nProvider initialLocale={locale} initialDictionary={dictionary}>
        <SessionProvider>
          <SocketProvider>
            {children}
          </SocketProvider>
        </SessionProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
