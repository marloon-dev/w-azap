'use client';

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/components/i18n-provider";

// Reached when the login cookie is still present but no longer valid (password/role changed,
// user deleted, expired). Clears the cookie so the middleware stops treating the user as logged in.
export default function SessionExpiredPage() {
    const { t } = useTranslation();

    useEffect(() => {
        signOut({ callbackUrl: "/auth/login" });
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-3 bg-background text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm">{t("auth.sessionExpired")}</p>
        </div>
    );
}
