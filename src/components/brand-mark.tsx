import { cn } from "@/lib/utils";

interface BrandMarkProps {
    className?: string;
}

/**
 * The W-AZAP mark: three rising signal bars inside the brand tile.
 * Each WhatsApp session is a "line" with a signal, so the mark is the signal itself.
 */
export function BrandMark({ className }: BrandMarkProps) {
    return (
        <span
            className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground", className)}
            aria-hidden="true"
        >
            <svg viewBox="0 0 24 24" className="size-[55%]" fill="currentColor">
                <rect x="3" y="14" width="4.5" height="7" rx="1.5" />
                <rect x="9.75" y="9" width="4.5" height="12" rx="1.5" />
                <rect x="16.5" y="3" width="4.5" height="18" rx="1.5" />
            </svg>
        </span>
    );
}
