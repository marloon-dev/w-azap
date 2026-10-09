import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

interface LegalPageProps {
    title: string;
    /** Fixed date of the text's last revision (not today's date) */
    updated: string;
    children: React.ReactNode;
}

/** Long-form legal text: a plain document column with a readable measure. */
export function LegalPage({ title, updated, children }: LegalPageProps) {
    return (
        <div className="min-h-dvh bg-background">
            <header className="border-b">
                <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
                    <Link href="/" className="flex items-center gap-2.5 rounded-md">
                        <BrandMark className="size-8" />
                        <span className="text-[15px] font-semibold tracking-tight text-foreground">W-AZAP</span>
                    </Link>
                    <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                        Home
                    </Link>
                </div>
            </header>
            <main className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
                <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">{title}</h1>
                <p className="mt-3 text-sm text-muted-foreground">
                    Last updated: <time dateTime={updated}>{updated}</time>
                </p>
                <article className="prose mt-10 max-w-[68ch] dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h2:mt-10 prose-h2:text-xl prose-a:text-primary prose-p:leading-relaxed">
                    {children}
                </article>
            </main>
        </div>
    );
}
