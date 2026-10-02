'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AuthRequestError, hasSession, loginAccount } from './auth-api';
import { authErrorText, fieldErrorText } from './auth-copy';
import { loginFieldErrors, type LoginDraft, type LoginField } from './auth-draft';
import { AuthFrame } from './auth-frame';
import styles from './auth.module.css';

export function LoginForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const [draft, setDraft] = useState<LoginDraft>({ workspace: '', email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<LoginField, FieldErrorView>>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    hasSession()
      .then((signedIn) => {
        if (active && signedIn) {
          router.replace(`/${locale}/contacts`);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [locale, router]);

  function update(field: LoginField, value: string): void {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function submit(): Promise<void> {
    const nextErrors = loginFieldErrors(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setPending(true);
    setBanner(null);
    try {
      await loginAccount(draft);
      router.push(`/${locale}/contacts`);
    } catch (caught) {
      const code = caught instanceof AuthRequestError ? caught.code : 'REQUEST_FAILED';
      setBanner(authErrorText(t, code));
      setPending(false);
    }
  }

  return (
    <AuthFrame title={t('welcome')}>
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {banner === null ? null : <p className={styles.banner}>{banner}</p>}
        <Field
          label={t('workspace')}
          value={draft.workspace}
          error={errors.workspace}
          autoComplete="organization"
          onChange={(value) => update('workspace', value)}
        />
        <Field
          label={t('email')}
          type="email"
          value={draft.email}
          error={errors.email}
          autoComplete="username"
          onChange={(value) => update('email', value)}
        />
        <Field
          label={t('password')}
          type="password"
          value={draft.password}
          error={errors.password}
          autoComplete="current-password"
          onChange={(value) => update('password', value)}
        />
        <button type="submit" className={styles.submit} disabled={pending}>
          {t('signIn')}
        </button>
        <button type="button" className={styles.textButton} disabled>
          {t('forgot')}
        </button>
      </form>
      <footer className={styles.footer}>
        <p>
          {t('createPrompt')}{' '}
          <Link className={styles.link} href={`/${locale}/sign-up`}>
            {t('createWorkspace')}
          </Link>
        </p>
        <p>
          <strong>{t('invitedTitle')}</strong>
        </p>
        <p className={styles.hint}>{t('invitedBody')}</p>
      </footer>
    </AuthFrame>
  );
}

type FieldErrorView = NonNullable<ReturnType<typeof loginFieldErrors>[LoginField]>;

function Field({
  label,
  value,
  error,
  type = 'text',
  autoComplete,
  onChange,
}: {
  label: string;
  value: string;
  error?: FieldErrorView;
  type?: 'text' | 'email' | 'password';
  autoComplete: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('auth');
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
      {error === undefined ? null : (
        <span className={styles.fieldError}>{fieldErrorText(t, error)}</span>
      )}
    </label>
  );
}
