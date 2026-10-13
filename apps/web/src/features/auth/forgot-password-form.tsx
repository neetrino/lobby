'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';

import { AuthRequestError, requestPasswordReset } from './auth-api';
import { authErrorText, fieldErrorText } from './auth-copy';
import { recoveryFieldErrors, type RecoveryDraft } from './auth-draft';
import { AuthFrame } from './auth-frame';
import styles from './auth.module.css';

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [draft, setDraft] = useState<RecoveryDraft>({ workspace: '', email: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof RecoveryDraft, string>>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(): Promise<void> {
    const nextErrors = recoveryFieldErrors(draft);
    setErrors(fieldText(t, nextErrors));
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setPending(true);
    setBanner(null);
    try {
      await requestPasswordReset({ ...draft, locale });
      setSent(true);
    } catch (caught) {
      const code = caught instanceof AuthRequestError ? caught.code : 'REQUEST_FAILED';
      setBanner(authErrorText(t, code));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame title={t('forgotTitle')} note={t('forgotNote')}>
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {banner === null ? null : <p className={styles.banner}>{banner}</p>}
        {sent ? <p className={styles.success}>{t('forgotSent')}</p> : null}
        <LabeledField
          label={t('workspace')}
          value={draft.workspace}
          error={errors.workspace}
          autoComplete="organization"
          onChange={(value) => setDraft((current) => ({ ...current, workspace: value }))}
        />
        <LabeledField
          label={t('email')}
          type="email"
          value={draft.email}
          error={errors.email}
          autoComplete="username"
          onChange={(value) => setDraft((current) => ({ ...current, email: value }))}
        />
        <button type="submit" className={styles.submit} disabled={pending}>
          {t('forgotSubmit')}
        </button>
      </form>
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
  errors: ReturnType<typeof recoveryFieldErrors>,
): Partial<Record<keyof RecoveryDraft, string>> {
  return {
    workspace: errors.workspace === undefined ? undefined : fieldErrorText(t, errors.workspace),
    email: errors.email === undefined ? undefined : fieldErrorText(t, errors.email),
  };
}

function LabeledField({
  label,
  value,
  error,
  type = 'text',
  autoComplete,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  type?: 'text' | 'email';
  autoComplete: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={error !== undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error === undefined ? null : <span className={styles.fieldError}>{error}</span>}
    </label>
  );
}
