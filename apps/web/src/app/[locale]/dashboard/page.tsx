import { supportedLocales, type Locale } from '@lobby/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { DashboardWorkspace } from '@/features/dashboard/dashboard-workspace';

type DashboardPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: DashboardPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: 'dashboard' });
  return { title: t('title') };
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  setRequestLocale(locale);
  return <DashboardWorkspace />;
}

function isLocale(value: string): value is Locale {
  return supportedLocales.some((locale) => locale === value);
}
