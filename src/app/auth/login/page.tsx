'use client';

import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  email: z.string().email(t("auth.invalidEmail")),
  password: z.string().min(1, t("auth.login.passwordRequired")),
});

type FormValues = z.infer<ReturnType<typeof createFormSchema>>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const form = useForm<FormValues>({
    resolver: zodResolver(createFormSchema(t)),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    setError(null);
    try {
      const result = await signIn('credentials', {
        redirect: false,
        email: values.email,
        password: values.password,
      });

      if (result?.error) {
        setError(result.code === "rate_limited" ? t("auth.login.rateLimited") : t("auth.login.invalidCredentials"));
      } else {
        window.location.href = callbackUrl;
        router.refresh();
      }
    } catch (err) {
      setError(t("common.unexpectedError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={t("auth.login.title")}
      subtitle={t("auth.login.subtitle")}
      footer={
        <>
          {t("auth.login.noAccount")}{" "}
          <Link href="/auth/register" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("auth.login.createAccount")}
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
                  <Input type="password" autoComplete="current-password" className="h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={loading}>
            {loading ? (
              <><Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t("auth.login.authenticating")}</>
            ) : (
              t("common.signIn")
            )}
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
