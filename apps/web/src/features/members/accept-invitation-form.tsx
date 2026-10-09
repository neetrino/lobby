'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AuthRequestError } from '../auth/auth-api';
import { authErrorText, fieldErrorText } from '../auth/auth-copy';
import { signInRequiredHref, signupFieldErrors } from '../auth/auth-draft';
import { AuthFrame } from '../auth/auth-frame';
import styles from '../auth/auth.module.css';
import {
  acceptInvitation,
  exchangeInvitation,
  previewInvitation,
  type InvitationPreview,
} from './members-api';

export function AcceptInvitationForm({
  invitationId,
  token,
}: {
  invitationId: string;
  token: string;
}) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [banner, setBanner] = useState<string | null>(invitationId.length === 0 ? t('acceptMissing') : null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (invitationId.length === 0) {
      return;
    }
    let active = true;
    const ready =
      token.length === 0
        ? Promise.resolve()
        : exchangeInvitation(invitationId, token).then(() => {
            const url = `/${locale}/invitations/accept?id=${encodeURIComponent(invitationId)}`;
            window.history.replaceState(window.history.state, '', url);
          });
    ready
      .then(() => previewInvitation(invitationId))
      .then((next) => {
        if (active) {
          setPreview(next);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setBanner(failureText(t, caught));
        }
      });
    return () => {
      active = false;
    };
  }, [invitationId, locale, t, token]);

  async function submit(): Promise<void> {
    const errors = signupFieldErrors({
      organization: 'ready',
      workspace: 'ready',
      name,
      email: 'ready@example.com',
      password,
      confirmPassword,
      locale: 'en',
    });
    if (errors.name !== undefined || errors.password !== undefined || errors.confirmPassword !== undefined) {
      setBanner(
        fieldErrorText(t, errors.name ?? errors.password ?? errors.confirmPassword ?? 'required'),
      );
      return;
    }
    setPending(true);
    setBanner(null);
    try {
      await acceptInvitation({ invitationId, name, password });
      router.push(`/${locale}/contacts`);
    } catch (caught) {
      if (caught instanceof AuthRequestError && caught.code === 'ACCOUNT_CREATED_SIGN_IN_REQUIRED' && preview !== null) {
        router.push(signInRequiredHref(locale, preview.subdomain, preview.email));
        return;
      }
      setBanner(failureText(t, caught));
      setPending(false);
    }
  }

  return (
    <AuthFrame title={t('acceptTitle', { organization: preview?.organizationName ?? '' })}>
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {banner === null ? null : <p className={styles.banner}>{banner}</p>}
        <p className={styles.hint}>
          {t('email')}: {preview?.email ?? ''}
        </p>
        <p className={styles.hint}>
          {t('roleLabel')}: {preview === null ? '' : t('memberRole')}
        </p>
        <label>
          {t('ownerName')}
          <input value={name} autoComplete="name" onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          {t('password')}
          <input
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label>
          {t('confirmPassword')}
          <input
            type="password"
            value={confirmPassword}
            autoComplete="new-password"
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>
        <button type="submit" className={styles.submit} disabled={pending || preview === null}>
          {t('acceptAction')}
        </button>
      </form>
    </AuthFrame>
  );
}

function failureText(t: ReturnType<typeof useTranslations<'auth'>>, caught: unknown): string {
  const code = caught instanceof AuthRequestError ? caught.code : 'REQUEST_FAILED';
  if (code === 'INVITATION_INVALID') {
    return t('errors.invitationInvalid');
  }
  if (code === 'INVITATION_EMAIL_TAKEN') {
    return t('errors.taken');
  }
  return authErrorText(t, code);
}
