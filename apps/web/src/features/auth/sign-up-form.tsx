'use client';

import { supportedLocales } from '@lobby/contracts';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AuthRequestError, registerOwner } from './auth-api';
import { authErrorText, fieldErrorText } from './auth-copy';
import {
  isAuthLocale,
  signupFieldErrors,
  type FieldError,
  type SignupDraft,
  type SignupField,
} from './auth-draft';
import { AuthFrame } from './auth-frame';
import styles from './auth.module.css';

export function SignUpForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const current = isAuthLocale(locale) ? locale : 'en';
  const router = useRouter();
  const [draft, setDraft] = useState<SignupDraft>({
    organization: '',
    workspace: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    locale: current,
  });
  const [errors, setErrors] = useState<Partial<Record<SignupField, FieldError>>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update(field: SignupField, value: string): void {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
  }

  async function submit(): Promise<void> {
    const nextErrors = signupFieldErrors(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setPending(true);
    setBanner(null);
    try {
      await registerOwner(draft);
      router.push(`/${draft.locale}/contacts`);
    } catch (caught) {
      const code = caught instanceof AuthRequestError ? caught.code : 'REQUEST_FAILED';
      setBanner(authErrorText(t, code));
      setPending(false);
    }
  }

  return (
    <AuthFrame title={t('signupTitle')} note={t('signupNote')}>
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {banner === null ? null : <p className={styles.banner}>{banner}</p>}
        <TextField
          label={t('organization')}
          value={draft.organization}
          error={errors.organization}
          autoComplete="organization"
          onChange={(value) => update('organization', value)}
        />
        <TextField
          label={t('workspace')}
          value={draft.workspace}
          error={errors.workspace}
          autoComplete="off"
          onChange={(value) => update('workspace', value.toLowerCase())}
        />
        <TextField
          label={t('ownerName')}
          value={draft.name}
          error={errors.name}
          autoComplete="name"
          onChange={(value) => update('name', value)}
        />
        <TextField
          label={t('email')}
          type="email"
          value={draft.email}
          error={errors.email}
          autoComplete="email"
          onChange={(value) => update('email', value)}
        />
        <TextField
          label={t('password')}
          type="password"
          value={draft.password}
          error={errors.password}
          autoComplete="new-password"
          onChange={(value) => update('password', value)}
        />
        <TextField
          label={t('confirmPassword')}
          type="password"
          value={draft.confirmPassword}
          error={errors.confirmPassword}
          autoComplete="new-password"
          onChange={(value) => update('confirmPassword', value)}
        />
        <label>
          {t('language')}
          <select
            value={draft.locale}
            onChange={(event) => {
              if (isAuthLocale(event.target.value)) {
                update('locale', event.target.value);
              }
            }}
          >
            {supportedLocales.map((item) => (
              <option key={item} value={item}>
                {t(`localeName.${item}`)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={styles.submit} disabled={pending}>
          {t('createWorkspace')}
        </button>
      </form>
      <footer className={styles.footer}>
        <p>
          {t('haveAccount')}{' '}
          <Link className={styles.link} href={`/${locale}/login`}>
            {t('signIn')}
          </Link>
        </p>
      </footer>
    </AuthFrame>
  );
}

function TextField({
  label,
  value,
  error,
  type = 'text',
  autoComplete,
  onChange,
}: {
  label: string;
  value: string;
  error?: FieldError;
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
