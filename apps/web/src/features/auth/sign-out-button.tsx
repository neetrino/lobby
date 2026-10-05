'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { logoutAccount } from './auth-api';
import styles from './auth.module.css';

export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      await logoutAccount();
      router.replace(`/${locale}/login`);
    } catch {
      setError(t('errors.signOutFailed'));
      setPending(false);
    }
  }

  return (
    <span className={styles.signOutGroup}>
      <button type="button" className={className} disabled={pending} onClick={() => void signOut()}>
        {t('signOut')}
      </button>
      {error === null ? null : (
        <p className={styles.banner} role="alert">
          {error}
        </p>
      )}
    </span>
  );
}
