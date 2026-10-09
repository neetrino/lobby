'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AuthRequestError, confirmPasswordReset } from './auth-api';
import { authErrorText, fieldErrorText } from './auth-copy';
import { resetFieldErrors, type ResetDraft } from './auth-draft';
import { AuthFrame } from './auth-frame';
import styles from './auth.module.css';

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const [draft, setDraft] = useState<ResetDraft>({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof ResetDraft, string>>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(): Promise<void> {
    const nextErrors = resetFieldErrors(draft);
    setErrors(fieldText(t, nextErrors));
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setPending(true);
    setBanner(null);
    try {
      await confirmPasswordReset({ token, password: draft.password });
      router.push(`/${locale}/login?notice=reset`);
    } catch (caught) {
      const code = caught instanceof AuthRequestError ? caught.code : 'REQUEST_FAILED';
      setBanner(authErrorText(t, code));
      setPending(false);
    }
  }

  return (
    <AuthFrame title={t('resetTitle')}>
      {token.length === 0 ? (
        <p className={styles.banner}>{t('resetMissing')}</p>
      ) : (
        <form
          className={styles.form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {banner === null ? null : <p className={styles.banner}>{banner}</p>}
          <PasswordField
            label={t('password')}
            value={draft.password}
            error={errors.password}
            onChange={(value) => setDraft((current) => ({ ...current, password: value }))}
          />
          <PasswordField
            label={t('confirmPassword')}
            value={draft.confirmPassword}
            error={errors.confirmPassword}
            onChange={(value) => setDraft((current) => ({ ...current, confirmPassword: value }))}
          />
          <button type="submit" className={styles.submit} disabled={pending}>
            {t('resetSubmit')}
          </button>
        </form>
      )}
      <footer className={styles.footer}>
        <Link className={styles.link} href={`/${locale}/login`}>
          {t('backToSignIn')}
        </Link>
      </footer>
    </AuthFrame>
  );
}

function fieldText(
  t: ReturnType<typeof useTranslations<'auth'>>,
  errors: ReturnType<typeof resetFieldErrors>,
): Partial<Record<keyof ResetDraft, string>> {
  return {
    password: errors.password === undefined ? undefined : fieldErrorText(t, errors.password),
    confirmPassword:
      errors.confirmPassword === undefined ? undefined : fieldErrorText(t, errors.confirmPassword),
  };
}

function PasswordField({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <input
        type="password"
        value={value}
        autoComplete="new-password"
        aria-invalid={error !== undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error === undefined ? null : <span className={styles.fieldError}>{error}</span>}
    </label>
  );
}
