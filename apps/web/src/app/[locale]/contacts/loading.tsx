import { getTranslations } from 'next-intl/server';

export default async function ContactsLoadingPage() {
  const t = await getTranslations('contacts');
  return <p>{t('loading')}</p>;
}
