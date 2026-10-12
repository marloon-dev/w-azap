"use client";

import { useEffect } from "react";

export function UpdateChecker({ enabled }: { enabled: boolean }) {
    useEffect(() => {
        if (!enabled) return;
        const checkUpdates = async () => {
            try {
                // Runs on every dashboard load; the server caches the result and deduplicates notifications
                await fetch('/api/system/check-updates', { method: 'POST' });
            } catch (error) {
                console.error("UpdateChecker: Failed", error);
            }
        };

        checkUpdates();
    }, [enabled]);

    return null; // Invisible component
}
