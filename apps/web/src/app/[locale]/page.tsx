import { supportedLocales, type Locale } from '@lobby/contracts';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LocalizedHomePage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations('home');

  return (
    <main>
      <p>{t('title')}</p>
      <Link href={`/${locale}/contacts`}>{t('contacts')}</Link>
    </main>
  );
}

function isLocale(value: string): value is Locale {
  return supportedLocales.some((locale) => locale === value);
}
