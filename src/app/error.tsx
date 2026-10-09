'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusPage } from '@/components/status-page';
import { useTranslation } from '@/components/i18n-provider';
import { cn } from '@/lib/utils';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error('Application runtime error boundary caught:', error);
  }, [error]);

  return (
    <StatusPage
      code="500"
      tone="danger"
      title={t("errorPages.errorTitle")}
      description={t("errorPages.errorDesc")}
      actions={
        <>
          <Button size="lg" onClick={() => reset()}>{t("errorPages.retry")}</Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard">{t("errorPages.home")}</Link>
          </Button>
        </>
      }
    >
      <div className="mt-10 border-t pt-4">
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          aria-expanded={showDetails}
          className="flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown className={cn("size-4 transition-transform", !showDetails && "-rotate-90")} aria-hidden="true" />
          {showDetails ? t("errorPages.hideDetails") : t("errorPages.showDetails")}
        </button>
        {showDetails && (
          <div className="styled-scrollbar mt-3 max-h-64 space-y-2 overflow-y-auto rounded-lg border bg-muted/50 p-4 font-mono text-xs leading-relaxed break-all text-muted-foreground">
            <p><span className="font-semibold text-foreground">Message:</span> {error.message || 'Unknown runtime error'}</p>
            {error.digest && <p><span className="font-semibold text-foreground">Digest:</span> {error.digest}</p>}
            {error.stack && <pre className="whitespace-pre-wrap border-t pt-2">{error.stack}</pre>}
          </div>
        )}
      </div>
    </StatusPage>
  );
}
