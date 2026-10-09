"use client";

import { useEffect } from "react";
import Link from "next/link";
import SwaggerUI from "swagger-ui-react";
import { ThemeToggle } from "@/components/theme-toggle";
import "swagger-ui-react/swagger-ui.css";

// Access control is enforced by the middleware (dashboard login required) and by /api/docs itself.
// The old client-side username/password check shipped its credentials in the JS bundle.
export default function ApiDocsPage() {
    useEffect(() => {
        // Suppress Swagger UI legacy lifecycle warnings (ModelCollapse)
        const originalWarn = console.warn;
        console.warn = (...args) => {
            if (typeof args[0] === 'string' &&
                args[0].includes('UNSAFE_componentWillReceiveProps') &&
                args[0].includes('ModelCollapse')) {
                return;
            }
            originalWarn(...args);
        };
        return () => {
            console.warn = originalWarn;
        };
    }, []);

    if (process.env.NEXT_PUBLIC_SWAGGER_ENABLED === "false") {
        return (
            <div className="flex items-center justify-center min-h-screen bg-muted/50 text-muted-foreground">
                Swagger UI is disabled.
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
                    <div className="min-w-0">
                        <h1 className="truncate text-lg font-semibold">W-AZAP · Swagger UI</h1>
                        <p className="text-sm text-muted-foreground">OpenAPI</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <ThemeToggle />
                        <Link
                            href="/dashboard"
                            className="inline-flex h-9 items-center rounded-md border border-input bg-card px-3 text-sm font-medium transition-colors hover:bg-accent"
                        >
                            Dashboard
                        </Link>
                    </div>
                </div>
            </header>

            {/* Swagger UI ships light-only styles: keep it on a light surface in both themes */}
            <div className="mx-auto max-w-7xl px-2 py-4 sm:px-6">
                <div className="overflow-hidden rounded-xl border bg-white text-neutral-900 [color-scheme:light]">
                    <SwaggerUI url="/api/docs" />
                </div>
            </div>
        </div>
    );
}
