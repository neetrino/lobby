import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { supportedLocales } from '@lobby/contracts';

import { PlatformWorkspace } from '../../../features/platform/platform-workspace';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(supportedLocales, locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: 'platform' });
  return { title: t('title') };
}

export default async function PlatformPage({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(supportedLocales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  return <PlatformWorkspace />;
}
