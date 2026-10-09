import { supportedLocales, type Locale } from '@lobby/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { ReservationsWorkspace } from '@/features/reservations/reservations-workspace';

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
  return (
    <Suspense>
      <ReservationsWorkspace />
    </Suspense>
  );
}

function isLocale(value: string): value is Locale {
  return supportedLocales.some((locale) => locale === value);
}
