'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react";
import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { useTranslation } from '@/components/i18n-provider';
import type { Translator } from '@/lib/i18n/translate';

const createFormSchema = (t: Translator) => z.object({
    name: z.string().min(2, t("auth.register.nameMin")),
    email: z.string().email(t("auth.invalidEmail")),
    password: z.string().min(8, t("auth.register.passwordMin")),
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: t("auth.register.passwordMismatch"),
    path: ["confirmPassword"],
});

type FormValues = z.infer<ReturnType<typeof createFormSchema>>;

export default function RegisterPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const { t } = useTranslation();

    const form = useForm<FormValues>({
        resolver: zodResolver(createFormSchema(t)),
        defaultValues: {
            name: "",
            email: "",
            password: "",
            confirmPassword: ""
        },
    });

    async function onSubmit(values: FormValues) {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: values.name,
                    email: values.email,
                    password: values.password,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || t("auth.register.failed"));
            }

            setSuccess(true);
            setTimeout(() => {
                router.push('/auth/login');
            }, 2000);

        } catch (err: any) {
            setError(err.message || t("common.unexpectedError"));
        } finally {
            setLoading(false);
        }
    }

    if (success) {
        return (
            <AuthShell title={t("auth.register.successTitle")}>
                <div role="status" className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    <span>{t("auth.register.successRedirect")}</span>
                </div>
            </AuthShell>
        );
    }

    return (
        <AuthShell
            title={t("auth.register.title")}
            subtitle={t("auth.register.subtitle")}
            footer={
                <>
                    {t("auth.register.haveAccount")}{" "}
                    <Link href="/auth/login" className="font-medium text-primary underline-offset-4 hover:underline">
                        {t("auth.register.signInLink")}
                    </Link>
                </>
            }
        >
            {error && (
                <div role="alert" className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                    {error}
                </div>
            )}

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t("auth.register.fullName")}</FormLabel>
                            <FormControl>
                                <Input autoComplete="name" className="h-11"
                                placeholder={t("auth.register.namePlaceholder")} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t("auth.email")}</FormLabel>
                            <FormControl>
                                <Input type="email" autoComplete="email" className="h-11" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t("auth.password")}</FormLabel>
                            <FormControl>
                                <Input type="password" autoComplete="new-password" className="h-11" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t("auth.register.confirmPassword")}</FormLabel>
                            <FormControl>
                                <Input type="password" autoComplete="new-password" className="h-11" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                    <Button type="submit" size="lg" className="mt-2 h-11 w-full text-base" disabled={loading}>
                        {loading ? (
                            <><Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t("auth.register.creating")}</>
                        ) : (
                            t("auth.register.submit")
                        )}
                    </Button>
                </form>
            </Form>

            <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
                {t("auth.register.agreePrefix")} <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">{t("auth.register.termsOfService")}</Link> {t("auth.register.and")} <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">{t("auth.register.privacyPolicy")}</Link>{t("auth.register.agreeSuffix") && ` ${t("auth.register.agreeSuffix")}`}.
            </p>
        </AuthShell>
    );
}
