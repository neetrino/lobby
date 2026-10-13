'use client';

import { useTranslations } from 'next-intl';

export default function ContactsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('contacts');

  return (
    <main>
      <p role="alert">{t('errors.generic')}</p>
      <button type="button" onClick={reset}>
        {t('retry')}
      </button>
    </main>
  );
}
