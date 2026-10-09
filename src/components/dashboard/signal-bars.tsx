import { cn } from "@/lib/utils";

/** How many of the three bars a session status lights up. */
function levelOf(status?: string) {
    if (status === "CONNECTED") return 3;
    if (status === "SCAN_QR" || status === "CONNECTING") return 1;
    return 0;
}

/**
 * Session status drawn as a phone signal (the same three bars as the brand mark):
 * full and green when connected, one amber bar while waiting for the QR code, empty otherwise.
 * Decorative: always pair it with the status text.
 */
export function SignalBars({ status, className }: { status?: string; className?: string }) {
    const level = levelOf(status);
    const lit = level === 3 ? "bg-signal" : "bg-warning";
    return (
        <span className={cn("inline-flex h-4 items-end gap-[3px]", className)} aria-hidden="true">
            {[0.45, 0.72, 1].map((height, index) => (
                <span
                    key={height}
                    className={cn("w-[4px] rounded-[1.5px]", index < level ? lit : "bg-border dark:bg-input/50")}
                    style={{ height: `${height * 100}%` }}
                />
            ))}
        </span>
    );
}
