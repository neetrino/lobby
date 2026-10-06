'use client';

import { useTranslations } from 'next-intl';

import type { Contact } from './contact';
import styles from './contacts-table.module.css';

const COLORS = ['#2563eb', '#0f766e', '#7c3aed', '#b45309', '#be123c', '#0369a1'] as const;

/** Initials for a person, building mark for an organization. Contacts store no photo. */
export function ContactAvatar({
  name,
  type,
  id,
}: {
  name: string;
  type: Contact['type'];
  id: string;
}) {
  if (type === 'organization') {
    return (
      <span className={styles.orgAvatar} aria-hidden="true">
        <BuildingIcon />
      </span>
    );
  }
  return (
    <span className={styles.avatar} style={{ background: avatarColor(id) }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function TypeBadge({ type }: { type: Contact['type'] }) {
  const t = useTranslations('contacts');
  const className = type === 'person' ? styles.personBadge : styles.orgBadgeLabel;
  return <span className={className}>{t(`typeBadge.${type}`)}</span>;
}

export function OwnerAvatar({ name }: { name: string }) {
  return (
    <span className={styles.ownerMark} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  const mark = `${parts[0]?.charAt(0) ?? ''}${parts[1]?.charAt(0) ?? ''}`;
  return mark.length > 0 ? mark.toLocaleUpperCase('hy') : '•';
}

function avatarColor(id: string): string {
  let hash = 0;
  for (const char of id) {
    hash = (hash + char.charCodeAt(0)) % COLORS.length;
  }
  return COLORS[hash] ?? COLORS[0];
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path d="M4 20h16M6 20V6l6-3 6 3v14M10 20v-4h4v4M9 9h.01M15 9h.01M9 13h.01M15 13h.01" />
    </svg>
  );
}
