'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { StatusPage } from '@/components/status-page';
import { useTranslation } from '@/components/i18n-provider';

export default function NotFound() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <StatusPage
      code="404"
      title={t("errorPages.notFoundTitle")}
      description={t("errorPages.notFoundDesc")}
      actions={
        <>
          <Button asChild size="lg">
            <Link href="/dashboard">{t("errorPages.home")}</Link>
          </Button>
          <Button variant="outline" size="lg" onClick={() => router.back()}>
            {t("errorPages.back")}
          </Button>
        </>
      }
    />
  );
}
