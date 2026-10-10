"use client";

import { useTranslation } from "@/components/i18n-provider";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Destructive confirmation used by the agenda screens. */
export function ConfirmDelete({
    open,
    title,
    description,
    confirmLabel,
    onCancel,
    onConfirm,
}: {
    open: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const { t } = useTranslation();
    return (
        <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{t("agenda.common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {confirmLabel ?? t("agenda.common.delete")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
