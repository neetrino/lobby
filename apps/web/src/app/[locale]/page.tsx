import { notFound } from 'next/navigation';

import { supportedLocales, type Locale } from '@lobby/contracts';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LocalizedHomePage({ params }: PageProps) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  return <main>Lobby</main>;
}
