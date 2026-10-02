import { Noto_Sans, Noto_Sans_Armenian } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

import { supportedLocales, type Locale } from '@lobby/contracts';

import { LocaleDocumentLang } from './locale-document-lang';

const sans = Noto_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '600', '700'],
});

const armenian = Noto_Sans_Armenian({
  subsets: ['armenian'],
  weight: ['400', '600', '700'],
});

type LocaleLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!hasLocale(supportedLocales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await messagesFor(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LocaleDocumentLang locale={locale} />
      <div
        lang={locale}
        style={{ fontFamily: `${armenian.style.fontFamily}, ${sans.style.fontFamily}, sans-serif` }}
      >
        {children}
      </div>
    </NextIntlClientProvider>
  );
}

export function generateStaticParams(): Array<{ locale: string }> {
  return supportedLocales.map((locale) => ({ locale }));
}

function messagesFor(locale: Locale): Promise<Record<string, unknown>> {
  switch (locale) {
    case 'hy':
      return import('../../messages/hy.json').then((module) => module.default);
    case 'ru':
      return import('../../messages/ru.json').then((module) => module.default);
    case 'en':
      return import('../../messages/en.json').then((module) => module.default);
  }
}
