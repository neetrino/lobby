import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { supportedLocales } from '@lobby/contracts';

import { ResetPasswordForm } from '../../../features/auth/reset-password-form';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(supportedLocales, locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('resetTitle'), referrer: 'no-referrer' };
}

export default async function ResetPasswordPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(supportedLocales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const query = await searchParams;
  const token = Array.isArray(query.token) ? (query.token[0] ?? '') : (query.token ?? '');
  return <ResetPasswordForm token={token} />;
}
