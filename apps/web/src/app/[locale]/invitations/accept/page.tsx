import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { supportedLocales } from '@lobby/contracts';

import { AcceptInvitationForm } from '../../../../features/members/accept-invitation-form';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ id?: string | string[]; token?: string | string[] }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(supportedLocales, locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('acceptAction') };
}

export default async function AcceptInvitationPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(supportedLocales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const query = await searchParams;
  return (
    <AcceptInvitationForm invitationId={firstQuery(query.id)} token={firstQuery(query.token)} />
  );
}

function firstQuery(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ?? '';
}
