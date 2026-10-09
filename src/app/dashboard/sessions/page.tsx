import { auth } from "@/lib/auth";
import { SessionManager } from "@/components/dashboard/session-manager";
import { getTranslations } from "@/lib/i18n/server";

export default async function SessionsPage() {
    const session = await auth();
    const { t } = await getTranslations();

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">{t("sessions.manageTitle")}</h1>
            <SessionManager user={session?.user} />
        </div>
    );
}
