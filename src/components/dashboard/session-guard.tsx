"use client";

import { useSession } from "./session-provider";
import { Bot, QrCode } from "lucide-react";
import { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/components/i18n-provider";

export function SessionGuard({ children }: { children: ReactNode }) {
    const { sessionId, loading, sessions } = useSession();
    const { t } = useTranslation();

    if (loading) {
        return <div className="flex h-full items-center justify-center p-8">{t("guard.loadingSession")}</div>;
    }

    if (!sessionId) {
        return (
            <div className="flex h-full flex-col items-center justify-center space-y-6 text-center p-8">
                <div className="rounded-full bg-green-100 p-6">
                    <QrCode className="h-12 w-12 text-green-600" />
                </div>
                <div className="space-y-2 max-w-md">
                    <h2 className="text-2xl font-bold tracking-tight">{t("guard.noActiveSession")}</h2>
                    <p className="text-gray-500">
                        {t("guard.selectSessionHint")}
                    </p>
                </div>

                {sessions.length === 0 && (
                    <div className="flex flex-col gap-2">
                        <p className="text-sm text-gray-500">{t("guard.noSessionsYet")}</p>
                        <Link href="/dashboard/sessions">
                            <Button variant="outline">{t("guard.createSession")}</Button>
                        </Link>
                    </div>
                )}
            </div>
        );
    }

    return <>{children}</>;
}
