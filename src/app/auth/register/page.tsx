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
import { Bot, ArrowRight, Loader2 } from "lucide-react";
import Link from 'next/link';
import { LanguageSwitcher } from '@/components/language-switcher';
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
            <div className="flex flex-col items-center justify-center min-h-screen bg-background relative overflow-hidden">
                <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
                <div className="glass-panel p-10 rounded-3xl flex flex-col items-center text-center max-w-sm animate-in zoom-in duration-500">
                    <div className="h-16 w-16 bg-success rounded-full flex items-center justify-center mb-6 shadow-lg shadow-success/20">
                        <Bot className="h-8 w-8 text-success-foreground" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">{t("auth.register.successTitle")}</h2>
                    <p className="text-muted-foreground">{t("auth.register.successRedirect")}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen relative overflow-hidden bg-background py-12">
            <div className="absolute top-4 right-4 z-20">
                <LanguageSwitcher />
            </div>
            {/* Background Orbs */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute top-0 right-0 translate-x-1/3 -translate-y-1/4 w-[40rem] h-[40rem] bg-success/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 left-0 -translate-x-1/4 translate-y-1/4 w-[30rem] h-[30rem] bg-primary/20 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 w-full max-w-md p-4 animate-in fade-in zoom-in-95 duration-500">
                <div className="flex flex-col items-center mb-8">
                    <div className="relative flex h-16 w-16 mb-4 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                        <Bot className="h-8 w-8" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("auth.register.title")}</h1>
                    <p className="text-muted-foreground mt-2">{t("auth.register.subtitle")}</p>
                </div>

                <div className="glass-panel rounded-3xl p-8 shadow-2xl shadow-black/5">
                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center font-medium animate-in shake duration-300">
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
                                        <FormLabel className="text-foreground/80">{t("auth.register.fullName")}</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder={t("auth.register.namePlaceholder")}
                                                className="h-12 px-4 rounded-xl bg-background/50 border-background/20 focus-visible:ring-primary/50 transition-all font-medium"
                                                {...field}
                                            />
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
                                        <FormLabel className="text-foreground/80">{t("auth.email")}</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="name@example.com"
                                                className="h-12 px-4 rounded-xl bg-background/50 border-background/20 focus-visible:ring-primary/50 transition-all font-medium"
                                                {...field}
                                            />
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
                                        <FormLabel className="text-foreground/80">{t("auth.password")}</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                placeholder="••••••••"
                                                className="h-12 px-4 rounded-xl bg-background/50 border-background/20 focus-visible:ring-primary/50 transition-all font-medium"
                                                {...field}
                                            />
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
                                        <FormLabel className="text-foreground/80">{t("auth.register.confirmPassword")}</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                placeholder="••••••••"
                                                className="h-12 px-4 rounded-xl bg-background/50 border-background/20 focus-visible:ring-primary/50 transition-all font-medium"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Button
                                type="submit"
                                size="lg"
                                className="w-full h-12 rounded-xl text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 mt-4"
                                disabled={loading}
                            >
                                {loading ? (
                                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t("auth.register.creating")}</>
                                ) : (
                                    <>{t("auth.register.submit")} <ArrowRight className="ml-2 h-5 w-5" /></>
                                )}
                            </Button>
                        </form>
                    </Form>

                    <div className="mt-6 text-xs text-center text-muted-foreground leading-relaxed">
                        {t("auth.register.agreePrefix")} <Link href="/terms" className="underline hover:text-foreground">{t("auth.register.termsOfService")}</Link> {t("auth.register.and")} <Link href="/privacy" className="underline hover:text-foreground">{t("auth.register.privacyPolicy")}</Link>{t("auth.register.agreeSuffix") && ` ${t("auth.register.agreeSuffix")}`}.
                    </div>
                </div>

                <div className="mt-8 text-center text-sm text-muted-foreground">
                    {t("auth.register.haveAccount")}{" "}
                    <Link href="/auth/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                        {t("auth.register.signInLink")}
                    </Link>
                </div>
            </div>
        </div>
    );
}
