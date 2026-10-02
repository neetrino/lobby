import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { supportedLocales } from '@lobby/contracts';

import { readRegistrationStatus } from '../../../features/auth/auth-api';
import { loginPrefill } from '../../../features/auth/auth-draft';
import { LoginForm } from '../../../features/auth/login-form';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    workspace?: string | string[];
    email?: string | string[];
    notice?: string | string[];
  }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(supportedLocales, locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('welcome') };
}

export default async function LoginPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(supportedLocales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const [registrationStatus, query] = await Promise.all([
    readRegistrationStatus(),
    searchParams,
  ]);
  return <LoginForm registrationStatus={registrationStatus} prefill={loginPrefill(query)} />;
}
