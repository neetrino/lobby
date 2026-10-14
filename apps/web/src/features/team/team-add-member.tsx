'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { SheetFrame } from '../../ui/side-sheet/side-sheet';
import { OverlayPortal } from '../contacts/overlay-portal';
import { inviteMember } from '../members/members-api';
import styles from './team.module.css';

export function AddMemberButton() {
  const t = useTranslations('team');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(email: string): Promise<void> {
    setPending(true);
    setNotice(null);
    try {
      await inviteMember(email, locale);
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
      <button type="button" className={styles.add} onClick={() => setOpen(true)}>
        {t('addShort')}
      </button>
      {notice === null ? null : <p className={styles.notice}>{notice}</p>}
      {open ? (
        <InviteSheet pending={pending} onClose={() => setOpen(false)} onSubmit={submit} />
      ) : null}
    </div>
  );
}

function InviteSheet({
  pending,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  onClose: () => void;
  onSubmit: (email: string) => Promise<void>;
}) {
  const t = useTranslations('team');
  return (
    <OverlayPortal onDismiss={onClose}>
      <SheetFrame label={t('addMember')} closeLabel={t('close')}>
        <form
          className={styles.invite}
          onSubmit={(event) => {
            event.preventDefault();
            const email = readEmail(event);
            if (email !== '') void onSubmit(email);
          }}
        >
          <header className={styles.inviteHead}>
            <h2>{t('addMember')}</h2>
          </header>
          <label>
            {t('inviteEmail')}
            <input type="email" name="email" required placeholder={t('inviteEmail')} />
          </label>
          <button type="submit" disabled={pending}>
            {t('addMember')}
          </button>
        </form>
      </SheetFrame>
    </OverlayPortal>
  );
}

function readEmail(event: FormEvent<HTMLFormElement>): string {
  return String(new FormData(event.currentTarget).get('email') ?? '').trim();
}
