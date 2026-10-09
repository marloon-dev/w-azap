import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

interface StatusPageProps {
    /** Short code shown large, e.g. "404" */
    code?: string;
    title: React.ReactNode;
    description: React.ReactNode;
    actions?: React.ReactNode;
    /** Extra content under the actions (technical details) */
    children?: React.ReactNode;
    tone?: "neutral" | "danger";
}

/** Full-page message for 404 and error states: what happened, then what to do. */
export function StatusPage({ code, title, description, actions, children, tone = "neutral" }: StatusPageProps) {
    return (
        <div className="flex min-h-dvh w-full flex-col bg-background px-4 sm:px-8">
            <header className="flex h-16 items-center">
                <Link href="/" className="flex items-center gap-2.5 rounded-md">
                    <BrandMark className="size-8" />
                    <span className="text-[15px] font-semibold tracking-tight text-foreground">W-AZAP</span>
                </Link>
            </header>
            <main className="flex flex-1 items-center justify-center py-12">
                <div className="w-full max-w-lg">
                    {code && (
                        <p
                            className={cn(
                                "font-condensed text-7xl font-semibold leading-none tracking-[-0.03em]",
                                tone === "danger" ? "text-destructive" : "text-muted-foreground/70",
                            )}
                            data-numeric
                        >
                            {code}
                        </p>
                    )}
                    <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
                    <p className="mt-3 text-base leading-relaxed text-muted-foreground">{description}</p>
                    {actions && <div className="mt-8 flex flex-col gap-3 sm:flex-row">{actions}</div>}
                    {children}
                </div>
            </main>
        </div>
    );
}
