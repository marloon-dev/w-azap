'use client';

import '@/app/globals.css';

// Rendered when the root layout itself fails, so no providers (i18n, theme) are available:
// a short bilingual message and a reload button are all this page can rely on.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-dvh items-center justify-center bg-background p-6 font-sans text-foreground antialiased">
        <main className="w-full max-w-lg">
          <p className="text-7xl font-semibold leading-none tracking-tight text-destructive">500</p>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">O W-AZAP não conseguiu carregar</h1>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Recarregue a página. Se o erro continuar, reinicie o servidor e confira os registros.
          </p>
          <p lang="en" className="mt-2 text-sm leading-relaxed text-muted-foreground">
            W-AZAP failed to load. Reload the page; if it keeps failing, restart the server and check the logs.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-8 inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Recarregar / Reload
          </button>
          {error.digest && <p className="mt-6 font-mono text-xs text-muted-foreground">Digest: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
