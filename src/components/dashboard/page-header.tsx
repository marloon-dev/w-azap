import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    icon?: LucideIcon;
    /** Primary/secondary actions, shown on the right (stacked below the title on mobile) */
    actions?: React.ReactNode;
    className?: string;
}

/** Consistent page title block for every dashboard page (one <h1> per page). */
export function PageHeader({ title, description, icon: Icon, actions, className }: PageHeaderProps) {
    return (
        <header className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
            <div className="flex min-w-0 items-start gap-3">
                {Icon && (
                    <span className="mt-0.5 hidden size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex" aria-hidden="true">
                        <Icon className="size-5" />
                    </span>
                )}
                <div className="min-w-0 space-y-1">
                    <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground">{title}</h1>
                    {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
                </div>
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
    );
}
