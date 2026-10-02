'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { ContactAvatar, TypeBadge } from './contact-avatar';
import { canManageLifecycle, type Contact, type SessionPrincipal } from './contact';
import { formatContactStamp } from './contact-format';
import styles from './contacts-table.module.css';

export function SelectionBar({
  selected,
  pageCount,
  session,
  pending,
  onArchive,
  onRestore,
  onClear,
}: {
  selected: readonly Contact[];
  pageCount: number;
  session: SessionPrincipal | null;
  pending: boolean;
  onArchive: (contact: Contact) => Promise<void>;
  onRestore: (contact: Contact) => Promise<void>;
  onClear: () => void;
}) {
  const t = useTranslations('contacts');
  const locale = useLocale();
  const one = selected.length === 1 ? selected[0] : undefined;
  if (selected.length === 0) {
    return null;
  }

  return (
    <div className={styles.bar}>
      <div className={styles.barTools}>
        <p className={styles.count}>
          {t('selectedCount', { count: selected.length, total: pageCount })}
        </p>
        <LifecycleButton
          selected={selected}
          session={session}
          pending={pending}
          onArchive={onArchive}
          onRestore={onRestore}
        />
        <button
          type="button"
          className={styles.clear}
          aria-label={t('clearSelection')}
          onClick={onClear}
        >
          ×
        </button>
      </div>
      {one !== undefined ? (
        <SelectedDetails contact={one} locale={locale} />
      ) : (
        <SelectedStack contacts={selected} />
      )}
    </div>
  );
}

function SelectedDetails({ contact, locale }: { contact: Contact; locale: string }) {
  const t = useTranslations('contacts');
  const stamp = formatContactStamp(contact.createdAt, locale);
  const archived = contact.archivedAt !== null;
  return (
    <div className={styles.details}>
      <ContactAvatar name={contact.name} type={contact.type} id={contact.id} />
      <div className={styles.identityText}>
        <span className={styles.nameLine}>
          <strong>{contact.name}</strong>
          <TypeBadge type={contact.type} />
        </span>
        <small title={contact.id}>ID: {contact.id.slice(0, 18)}</small>
      </div>
      <div className={styles.lines}>
        <span>{contact.email ?? '—'}</span>
        <span>{contact.phone ?? '—'}</span>
      </div>
      <span className={archived ? styles.statusArchived : styles.statusActive}>
        {archived ? t('status.archived') : t('status.active')}
      </span>
      <div className={styles.stamp}>
        <span>{stamp.date}</span>
        <small>{stamp.time}</small>
      </div>
    </div>
  );
}

function SelectedStack({ contacts }: { contacts: readonly Contact[] }) {
  return (
    <div className={styles.stack}>
      {contacts.slice(0, 4).map((contact) => (
        <ContactAvatar key={contact.id} name={contact.name} type={contact.type} id={contact.id} />
      ))}
    </div>
  );
}

function LifecycleButton({
  selected,
  session,
  pending,
  onArchive,
  onRestore,
}: {
  selected: readonly Contact[];
  session: SessionPrincipal | null;
  pending: boolean;
  onArchive: (contact: Contact) => Promise<void>;
  onRestore: (contact: Contact) => Promise<void>;
}) {
  const t = useTranslations('contacts');
  const [busy, setBusy] = useState(false);
  const first = selected[0];
  if (first === undefined) {
    return null;
  }
  const archived = first.archivedAt !== null;
  const uniform = selected.every((row) => (row.archivedAt !== null) === archived);
  const allowed =
    uniform && session !== null && selected.every((row) => canManageLifecycle(session, row));
  if (!uniform) {
    return null;
  }

  return (
    <button
      type="button"
      className={styles.archive}
      disabled={!allowed || pending || busy}
      onClick={() => void runLifecycle(selected, archived, onArchive, onRestore, setBusy)}
    >
      <ArchiveIcon />
      {archived ? t('restore') : t('archive')}
    </button>
  );
}

async function runLifecycle(
  selected: readonly Contact[],
  archived: boolean,
  onArchive: (contact: Contact) => Promise<void>,
  onRestore: (contact: Contact) => Promise<void>,
  setBusy: (busy: boolean) => void,
): Promise<void> {
  setBusy(true);
  try {
    for (const contact of selected) {
      if (archived) {
        await onRestore(contact);
      } else {
        await onArchive(contact);
      }
    }
  } finally {
    setBusy(false);
  }
}

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M4 5h16v4H4z" />
      <path d="M6 9v9h12V9" />
      <path d="M12 11v5" />
      <path d="M9.5 14.5L12 17l2.5-2.5" />
    </svg>
  );
}
