import { supportedLocales, type Locale } from '@lobby/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ReservationsPage as ReservationsWorkspace } from '@/features/contacts/lazy-pages';

type ReservationsPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: ReservationsPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'reservations' });
  return { title: t('title') };
}

export default async function ReservationsPage({ params }: ReservationsPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  return <ReservationsWorkspace />;
}

function isLocale(value: string): value is Locale {
  return supportedLocales.some((locale) => locale === value);
}
