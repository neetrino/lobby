import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { supportedLocales } from '@lobby/contracts';

import { LoginForm } from '../../../features/auth/login-form';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(supportedLocales, locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('welcome') };
}

export default async function LoginPage({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(supportedLocales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  return <LoginForm />;
}
