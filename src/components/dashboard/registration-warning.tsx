"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { AlertCircle, ShieldAlert } from "lucide-react";
import { useTranslation } from "@/components/i18n-provider";

interface RegistrationWarningProps {
    role?: string;
    registrationEnabled?: boolean;
}

export function RegistrationWarning({ role, registrationEnabled }: RegistrationWarningProps) {
    const { t } = useTranslation();

    useEffect(() => {
        if (role === "SUPERADMIN" && registrationEnabled) {
            // Delay toast slightly to wait for `<Toaster>` provider mount in layout
            const timer = setTimeout(() => {
                toast(t("registrationWarning.title"), {
                    description: t("registrationWarning.description"),
                    icon: <ShieldAlert className="text-warning w-5 h-5" />,
                    duration: 8000,
                    position: "top-center",
                    action: {
                        label: t("registrationWarning.settings"),
                        onClick: () => window.location.href = "/dashboard/settings"
                    }
                });
            }, 1000);

            return () => clearTimeout(timer);
        }
    }, [role, registrationEnabled, t]);

    return null;
}
