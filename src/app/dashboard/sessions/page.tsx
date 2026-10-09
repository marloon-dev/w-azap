import { auth } from "@/lib/auth";
import { SessionManager } from "@/components/dashboard/session-manager";
import { getTranslations } from "@/lib/i18n/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function SessionsPage() {
    const session = await auth();
    const { t } = await getTranslations();

    return (
        <div className="mx-auto w-full max-w-6xl">
            <PageHeader
                title={t("sessions.manageTitle")}
                description={t("sessions.activeDesc")}
                actions={
                    <Button asChild>
                        <a href="#new-session">
                            <Plus aria-hidden="true" /> {t("sessions.createTitle")}
                        </a>
                    </Button>
                }
            />
            <SessionManager user={session?.user} />
        </div>
    );
}
