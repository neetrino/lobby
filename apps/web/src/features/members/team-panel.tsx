'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { AuthRequestError } from '../auth/auth-api';
import { authErrorText } from '../auth/auth-copy';
import { AuthFrame } from '../auth/auth-frame';
import styles from '../auth/auth.module.css';
import {
  inviteMember,
  readTeam,
  resendInvitation,
  revokeInvitation,
  type TeamSnapshot,
} from './members-api';

export function TeamPanel() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [team, setTeam] = useState<TeamSnapshot | null>(null);
  const [email, setEmail] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    readTeam()
      .then((snapshot) => {
        if (active) {
          setTeam(snapshot);
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
  }, [t]);

  async function reload(): Promise<void> {
    setTeam(await readTeam());
  }

  async function submit(): Promise<void> {
    setPending(true);
    setBanner(null);
    try {
      await inviteMember(email, locale);
      setEmail('');
      await reload();
    } catch (caught) {
      setBanner(failureText(t, caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame title={t('teamTitle')} note={t('teamNote')}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {banner === null ? null : <p className={styles.banner}>{banner}</p>}
        <label>
          {t('email')}
          <input
            type="email"
            value={email}
            autoComplete="off"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <p className={styles.hint}>{t('memberRole')}</p>
        <button type="submit" className={styles.submit} disabled={pending || email.trim().length === 0}>
          {t('inviteMember')}
        </button>
      </form>
      <section className={styles.footer}>
        <p>
          <strong>{t('pendingInvitations')}</strong>
        </p>
        {(team?.invitations ?? []).map((invitation) => (
          <InvitationRow
            key={invitation.id}
            email={invitation.email}
            meta={`${t('invitedBy', { name: invitation.invitedByName })} · ${t('expires', { date: invitation.expiresAt.slice(0, 16).replace('T', ' ') })}`}
            onResend={() => resendInvitation(invitation.id, locale).then(() => reload())}
            onRevoke={() => revokeInvitation(invitation.id).then(() => reload())}
            onFailure={(caught) => setBanner(failureText(t, caught))}
          />
        ))}
        <p>
          <strong>{t('activeMembers')}</strong>
        </p>
        {(team?.members ?? []).map((member) => (
          <p key={member.id}>
            {member.name} · {member.email} · {member.role}
          </p>
        ))}
      </section>
    </AuthFrame>
  );
}

function InvitationRow({
  email,
  meta,
  onResend,
  onRevoke,
  onFailure,
}: {
  email: string;
  meta: string;
  onResend: () => Promise<void>;
  onRevoke: () => Promise<void>;
  onFailure: (error: unknown) => void;
}) {
  const t = useTranslations('auth');
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    try {
      await action();
    } catch (caught) {
      onFailure(caught);
    } finally {
      setBusy(false);
    }
  }
  return (
    <p>
      {email}
      <span className={styles.hint}> {meta}</span>{' '}
      <button
        type="button"
        className={styles.textButton}
        disabled={busy}
        onClick={() => void run(onResend)}
      >
        {t('resend')}
      </button>{' '}
      <button type="button" className={styles.textButton} disabled={busy} onClick={() => void run(onRevoke)}>
        {t('revoke')}
      </button>
    </p>
  );
}

function failureText(t: ReturnType<typeof useTranslations<'auth'>>, caught: unknown): string {
  const code = caught instanceof AuthRequestError ? caught.code : 'REQUEST_FAILED';
  if (code === 'INVITATION_EMAIL_TAKEN') {
    return t('errors.taken');
  }
  if (code === 'INVITATION_ALREADY_PENDING') {
    return t('errors.invitationPending');
  }
  if (code === 'INVITATION_UNAVAILABLE') {
    return t('errors.invitationUnavailable');
  }
  return authErrorText(t, code);
}
