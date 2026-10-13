import { supportedLocales, type Locale } from '@lobby/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { TeamPage as TeamDirectoryPage } from '@/features/contacts/lazy-pages';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: 'team' });
  return { title: t('title') };
}

export default async function TeamPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  setRequestLocale(locale);
  return <TeamDirectoryPage />;
}

function isLocale(value: string): value is Locale {
  return supportedLocales.some((locale) => locale === value);
}
