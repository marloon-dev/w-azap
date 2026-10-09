'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { StatusPage } from '@/components/status-page';
import { useTranslation } from '@/components/i18n-provider';
import type { TranslationKey } from '@/lib/i18n/types';

const KNOWN_CODES = ['400', '401', '403', '429', '500'] as const;

function ErrorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const code = searchParams.get('code') || '500';
  const customMessage = searchParams.get('message');
  const known = (KNOWN_CODES as readonly string[]).includes(code);

  const title = known ? t(`errorPages.c${code}Title` as TranslationKey) : t('errorPages.unknownTitle');
  const description = customMessage || (known ? t(`errorPages.c${code}Desc` as TranslationKey) : t('errorPages.unknownDesc'));

  return (
    <StatusPage
      code={code}
      tone={code === '500' ? 'danger' : 'neutral'}
      title={title}
      description={description}
      actions={
        <>
          {code === '401' ? (
            <Button asChild size="lg">
              <Link href="/auth/login">{t('common.signIn')}</Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link href="/dashboard">{t('errorPages.home')}</Link>
            </Button>
          )}
          <Button variant="outline" size="lg" onClick={() => router.back()}>
            {t('errorPages.back')}
          </Button>
        </>
      }
    />
  );
}

export default function GenericErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <ErrorContent />
    </Suspense>
  );
}
