'use client';

import type { KeyboardEvent, ReactElement } from 'react';
import { useTranslations } from 'next-intl';

import type { TeamMember } from './team-api';
import styles from './team.module.css';

const AVATAR_COLORS = [
  '#5b8def',
  '#f0a35e',
  '#e07a9a',
  '#7d8b73',
  '#c47b5a',
  '#6f8f72',
  '#d37b73',
  '#8b7ec8',
] as const;

export function TeamMemberCard({
  member,
  isSelf,
  selected,
  onOpen,
  onMessage,
}: {
  member: TeamMember;
  isSelf: boolean;
  selected: boolean;
  onOpen: (member: TeamMember) => void;
  onMessage: (member: TeamMember) => void;
}): ReactElement {
  const t = useTranslations('team');
  const roles = useTranslations('contacts');
  const subtitle = member.jobTitle ?? roles(`role.${member.role}`);
  return (
    <article
      className={selected ? `${styles.card} ${styles.cardSelected}` : styles.card}
      tabIndex={0}
      onClick={() => onOpen(member)}
      onKeyDown={(event) => openCardKey(event, () => onOpen(member))}
    >
      <span
        className={styles.avatar}
        style={{ background: teamAvatarColor(member.id) }}
        aria-hidden="true"
      >
        {teamInitials(member.name)}
      </span>
      <strong className={styles.name}>{member.name}</strong>
      <span className={styles.profession}>{subtitle}</span>
      {isSelf ? (
        <span className={styles.you}>{t('you')}</span>
      ) : (
        <button
          type="button"
          className={styles.emailButton}
          aria-label={t('message', { name: member.name })}
          onClick={(event) => {
            event.stopPropagation();
            onMessage(member);
          }}
        >
          <MailIcon />
          {t('emailAction')}
        </button>
      )}
    </article>
  );
}

export function teamInitials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2);
  const mark = letters.map((part) => part.charAt(0).toUpperCase()).join('');
  return mark.length > 0 ? mark : '?';
}

export function teamAvatarColor(id: string): string {
  let hash = 0;
  for (const char of id) {
    hash = (hash + char.charCodeAt(0)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash] ?? AVATAR_COLORS[0];
}

function openCardKey(event: KeyboardEvent<HTMLElement>, open: () => void): void {
  if (event.target !== event.currentTarget) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  open();
}

function MailIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16v12H4zM4 7l8 6 8-6" />
    </svg>
  );
}
