'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { inviteMember } from '../members/members-api';
import styles from './team.module.css';

export function AddMemberButton() {
  const t = useTranslations('team');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    try {
      await inviteMember(email.trim(), locale);
      setEmail('');
      setOpen(false);
      setNotice(t('inviteSent'));
    } catch {
      setNotice(t('inviteFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {open ? (
        <form className={styles.invite} onSubmit={(event) => void submit(event)}>
          <input type="email" required value={email} placeholder={t('inviteEmail')} aria-label={t('inviteEmail')} onChange={(event) => setEmail(event.target.value)} />
          <button type="submit" disabled={pending || email.trim().length === 0}>{t('addMember')}</button>
        </form>
      ) : (
        <button type="button" className={styles.add} onClick={() => setOpen(true)}>{t('addMember')}</button>
      )}
      {notice === null ? null : <p className={styles.notice}>{notice}</p>}
    </div>
  );
}
