import { supportedLocales, type Locale } from '@lobby/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { ContactsLoading, ContactsWorkspace } from '@/features/contacts/contacts-workspace';

type ContactsPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: ContactsPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: 'contacts' });
  return { title: t('title') };
}

export default async function ContactsPage({ params }: ContactsPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <Suspense fallback={<ContactsLoading />}>
      <ContactsWorkspace />
    </Suspense>
  );
}

function isLocale(value: string): value is Locale {
  return supportedLocales.some((locale) => locale === value);
}
