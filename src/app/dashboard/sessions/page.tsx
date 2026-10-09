import { auth } from "@/lib/auth";
import { SessionManager } from "@/components/dashboard/session-manager";
import { getTranslations } from "@/lib/i18n/server";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function SessionsPage() {
    const session = await auth();
    const { t } = await getTranslations();

    return (
        <div className="mx-auto w-full max-w-6xl">
            <PageHeader title={t("sessions.manageTitle")} description={t("sessions.activeDesc")} />
            <SessionManager user={session?.user} />
        </div>
    );
}
