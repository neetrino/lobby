'use client';

import { useTranslations } from 'next-intl';

import { AuthFrame } from '../../../features/auth/auth-frame';
import styles from '../../../features/auth/auth.module.css';

export default function ContactsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('contacts');

  return (
    <AuthFrame title={t('errors.title')} note={t('errors.generic')}>
      <div className={styles.form}>
        <button type="button" className={styles.submit} onClick={reset}>
          {t('retry')}
        </button>
      </div>
    </AuthFrame>
  );
}
