'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';

import { updateJobTitle, type TeamMember } from './team-api';
import styles from './team.module.css';

const AVATAR_COLORS = ['#5b8def', '#f0a35e', '#e07a9a', '#7d8b73', '#c47b5a', '#6f8f72', '#d37b73', '#8b7ec8'] as const;

export function TeamMemberCard({
  member,
  isSelf,
  selected,
  canEditProfession,
  onMessage,
  onProfession,
}: {
  member: TeamMember;
  isSelf: boolean;
  selected: boolean;
  canEditProfession: boolean;
  onMessage: (member: TeamMember) => void;
  onProfession: (member: TeamMember) => void;
}) {
  const t = useTranslations('team');
  const roles = useTranslations('contacts');
  const subtitle = member.jobTitle ?? roles(`role.${member.role}`);
  return (
    <article className={selected ? `${styles.card} ${styles.cardSelected}` : styles.card}>
      {canEditProfession ? <ProfessionMenu member={member} onSaved={onProfession} /> : null}
      <span className={styles.avatar} style={{ background: avatarColor(member.id) }} aria-hidden="true">
        {initials(member.name)}
      </span>
      <strong className={styles.name}>{member.name}</strong>
      <span className={styles.profession}>{subtitle}</span>
      {isSelf ? <span className={styles.you}>{t('you')}</span> : (
        <button type="button" className={styles.emailButton} aria-label={t('message', { name: member.name })} onClick={() => onMessage(member)}>
          <MailIcon />
          {t('emailAction')}
        </button>
      )}
    </article>
  );
}

function ProfessionMenu({ member, onSaved }: { member: TeamMember; onSaved: (member: TeamMember) => void }) {
  const t = useTranslations('team');
  const [value, setValue] = useState(member.jobTitle ?? '');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setFailed(false);
    try {
      onSaved(await updateJobTitle(member.id, value.trim() === '' ? null : value.trim()));
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <details className={styles.menu}>
      <summary aria-label={t('more')}>⋯</summary>
      <form className={styles.menuPanel} onSubmit={(event) => void submit(event)}>
        <label>
          {t('profession')}
          <input value={value} maxLength={80} onChange={(event) => setValue(event.target.value)} />
        </label>
        <button type="submit" disabled={pending}>{t('saveProfession')}</button>
        {failed ? <span className={styles.failed}>{t('professionFailed')}</span> : null}
      </form>
    </details>
  );
}

function initials(name: string): string {
  const letters = name.trim().split(/\s+/).filter((part) => part.length > 0).slice(0, 2);
  const mark = letters.map((part) => part.charAt(0).toUpperCase()).join('');
  return mark.length > 0 ? mark : '?';
}

function avatarColor(id: string): string {
  let hash = 0;
  for (const char of id) {
    hash = (hash + char.charCodeAt(0)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash] ?? AVATAR_COLORS[0];
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16v12H4zM4 7l8 6 8-6" />
    </svg>
  );
}
