import Link from "next/link";
import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import fs from "fs";
import path from "path";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMark } from "@/components/brand-mark";
import { SignalBars } from "@/components/dashboard/signal-bars";
import { getTranslations } from "@/lib/i18n/server";

const REPO_URL = "https://github.com/marloon-dev/w-azap";

export const metadata = {
  title: "W-AZAP | WhatsApp Gateway",
  description: "Self-hosted dashboard to connect several WhatsApp numbers, answer chats, automate replies and integrate through a REST API.",
  openGraph: {
    title: "W-AZAP | WhatsApp Gateway",
    description: "Self-hosted WhatsApp gateway: several numbers, live chats, auto-replies, webhooks and a REST API.",
    type: "website",
    url: process.env.NEXT_PUBLIC_APP_URL || "https://w-azap.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "W-AZAP | WhatsApp Gateway",
    description: "Self-hosted WhatsApp gateway: several numbers, live chats, auto-replies, webhooks and a REST API.",
  },
};

const API_EXAMPLE = `curl -X POST \\
  "$W_AZAP/api/messages/vendas-01/5511987654321@s.whatsapp.net/send" \\
  -H "X-API-Key: $CHAVE" \\
  -H "Content-Type: application/json" \\
  -d '{"message":{"text":"Seu pedido saiu para entrega."}}'`;

export default async function Home() {
  const { t, locale } = await getTranslations();
  let version = "";
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    version = packageJson.version;
  } catch (error) {
    console.error("Failed to read package.json", error);
  }

  const mockSessions = [
    { name: t("landing.mockSession1"), status: "CONNECTED" },
    { name: t("landing.mockSession2"), status: "CONNECTED" },
    { name: t("landing.mockSession3"), status: "SCAN_QR" },
  ];

  const features = [
    { title: t("landing.featureChatTitle"), description: t("landing.featureChatDesc") },
    { title: t("landing.featureAutomateTitle"), description: t("landing.featureAutomateDesc") },
    { title: t("landing.featureIntegrateTitle"), description: t("landing.featureIntegrateDesc") },
    { title: t("landing.featureControlTitle"), description: t("landing.featureControlDesc") },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 rounded-md">
            <BrandMark className="size-8" />
            <span className="text-[15px] font-semibold tracking-tight text-foreground">W-AZAP</span>
          </Link>

          <nav aria-label={t("common.mainNavigation")} className="hidden items-center gap-7 text-sm md:flex">
            <Link href="#recursos" className="text-muted-foreground transition-colors hover:text-foreground">{t("landing.features")}</Link>
            <Link href="/docs" className="text-muted-foreground transition-colors hover:text-foreground">{t("landing.apiDocs")}</Link>
            <Link href={REPO_URL} className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground">
              <Github className="size-4" aria-hidden="true" /> GitHub
            </Link>
          </nav>

          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
            <Button asChild size="sm" className="ml-1.5">
              <Link href="/auth/login">{t("common.signIn")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero: the promise on the left, the product's own status view on the right */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pt-24 lg:pb-28">
          <div>
            {version && (
              <Link
                href={`${REPO_URL}/releases`}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                data-numeric
              >
                {t("landing.releaseLive", { version })}
              </Link>
            )}
            <h1 className="font-condensed mt-4 text-[clamp(2.75rem,7vw,5rem)] font-semibold leading-[0.95] tracking-[-0.025em] text-foreground">
              <span className="block">{t("landing.heroLine1")}</span>
              <span className="block">{t("landing.heroLine2")}</span>
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted-foreground">
              {t("landing.heroDescription")}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link href="/dashboard">{t("landing.enterDashboard")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
                <Link href="/docs">{t("landing.readDocs")}</Link>
              </Button>
            </div>
          </div>

          <figure aria-label={t("landing.mockLabel")} className="overflow-hidden rounded-2xl border bg-card shadow-[0_24px_60px_-28px_hsl(var(--shadow-color)/0.35)]">
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <span className="text-sm font-semibold text-foreground">{t("home.sessions")}</span>
              <span className="text-sm text-muted-foreground" data-numeric>{mockSessions.length}</span>
            </div>
            <ul className="divide-y">
              {mockSessions.map((session) => (
                <li key={session.name} className="flex items-center gap-4 px-5 py-4">
                  <SignalBars status={session.status} className="h-5" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-semibold leading-tight tracking-tight text-foreground">{session.name}</span>
                    <span className={session.status === "CONNECTED" ? "text-sm font-medium text-success" : "text-sm font-medium text-warning"}>
                      {t(session.status === "CONNECTED" ? "status.CONNECTED" : "status.SCAN_QR")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <figcaption className="flex items-baseline justify-between gap-4 border-t bg-muted/40 px-5 py-4">
              <span className="text-sm text-muted-foreground">{t("landing.mockMessages")}</span>
              <span className="text-2xl font-semibold tracking-tight text-foreground" data-numeric>
                {new Intl.NumberFormat(locale).format(1284)}
              </span>
            </figcaption>
          </figure>
        </section>

        {/* What it does: four plain statements, not a card grid */}
        <section id="recursos" className="scroll-mt-20 border-y bg-card">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_2fr] lg:gap-16">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{t("landing.featuresTitle")}</h2>
            <dl className="divide-y border-y">
              {features.map((feature) => (
                <div key={feature.title} className="grid gap-1 py-5 sm:grid-cols-[11rem_1fr] sm:gap-8">
                  <dt className="text-base font-semibold text-foreground">{feature.title}</dt>
                  <dd className="text-base leading-relaxed text-muted-foreground">{feature.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* API: show the real call */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{t("landing.apiTitle")}</h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">{t("landing.apiDesc")}</p>
            <Button asChild variant="outline" className="mt-7">
              <Link href="/docs">{t("landing.readDocs")}</Link>
            </Button>
          </div>
          <pre className="styled-scrollbar overflow-x-auto rounded-xl border bg-[#0f1513] p-5 text-[13px] leading-relaxed text-[#cfe3d8] dark:bg-black/40">
            <code className="font-mono">{API_EXAMPLE}</code>
          </pre>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>{t("landing.copyright", { year: new Date().getFullYear() })}</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="transition-colors hover:text-foreground">{t("landing.privacy")}</Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">{t("landing.terms")}</Link>
            <Link href={REPO_URL} className="transition-colors hover:text-foreground">GitHub</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
