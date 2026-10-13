import { supportedLocales, type Locale } from '@lobby/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { WorkspaceSettings } from '@/features/settings/workspace-settings';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: 'contacts' });
  return { title: t('settingsTitle') };
}

export default async function SettingsPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  setRequestLocale(locale);
  return <WorkspaceSettings />;
}

function isLocale(value: string): value is Locale {
  return supportedLocales.some((locale) => locale === value);
}
