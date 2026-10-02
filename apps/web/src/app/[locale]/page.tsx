import { supportedLocales, type Locale } from '@lobby/contracts';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';

import { readRegistrationStatus } from '../../features/auth/auth-api';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LocalizedHomePage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations('home');
  const auth = await getTranslations('auth');
  const registrationStatus = await readRegistrationStatus();

  return (
    <main>
      <p>{t('title')}</p>
      <Link href={`/${locale}/contacts`}>{t('contacts')}</Link>
      <Link href={`/${locale}/login`}>{t('signIn')}</Link>
      {registrationStatus === 'enabled' ? (
        <Link href={`/${locale}/sign-up`}>{t('createWorkspace')}</Link>
      ) : (
        <p>
          {registrationStatus === 'disabled' ? auth('errors.disabled') : auth('errors.unavailable')}
        </p>
      )}
    </main>
  );
}

function isLocale(value: string): value is Locale {
  return supportedLocales.some((locale) => locale === value);
}
