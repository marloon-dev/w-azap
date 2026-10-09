import { auth } from "@/lib/auth";
import { Navbar } from "@/components/dashboard/navbar";
import { SessionProvider } from "@/components/dashboard/session-provider";
import { SidebarProvider } from "@/components/dashboard/sidebar-context";
import { SidebarShell } from "@/components/dashboard/sidebar-shell";
import { UpdateChecker } from "@/components/dashboard/update-checker";
import { RegistrationWarning } from "@/components/dashboard/registration-warning";
import { prisma } from "@/lib/prisma";
import { ThemedToaster } from "@/components/themed-toaster";
import pkg from "../../../package.json";
import { redirect } from "next/navigation";
import { getTranslations } from "@/lib/i18n/server";


export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();
    // auth() re-validates against the database; a stale cookie lands here as null
    if (!session?.user) redirect("/auth/expired");
    // @ts-ignore
    const systemConfig = await prisma.systemConfig.findUnique({ where: { id: "default" } });
    const appName = systemConfig?.appName || "W-AZAP";
    const registrationEnabled = systemConfig?.enableRegistration ?? false;
    const { t } = await getTranslations();

    return (
        <SessionProvider>
            <SidebarProvider>
                <UpdateChecker enabled={session?.user?.role === "SUPERADMIN"} />
                <RegistrationWarning
                    role={session?.user?.role as string}
                    registrationEnabled={registrationEnabled}
                />
                <a
                    href="#main-content"
                    className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
                >
                    {t("common.skipToContent")}
                </a>
                <div className="relative flex h-dvh overflow-hidden bg-background" suppressHydrationWarning={true}>
                    {/* Sidebar */}
                    <SidebarShell
                        appName={appName}
                        userName={session?.user?.name}
                        userEmail={session?.user?.email}
                        version={pkg.version}
                    />

                    {/* Main Content */}
                    <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden" suppressHydrationWarning={true}>
                        <Navbar appName={appName} />
                        <main id="main-content" tabIndex={-1} className="styled-scrollbar flex-1 overflow-auto px-4 py-5 outline-none sm:px-6 sm:py-6 lg:px-8">
                            {children}
                        </main>
                    </div>
                    <ThemedToaster />
                </div>
            </SidebarProvider>
        </SessionProvider>
    );
}
