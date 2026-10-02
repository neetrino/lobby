'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';

import { canManageLifecycle, type Contact, type SessionPrincipal } from './contact';
import styles from './contacts-table.module.css';

export function ContactRowActions({
  contact,
  session,
  onEdit,
  onArchive,
  onRestore,
}: {
  contact: Contact;
  session: SessionPrincipal | null;
  onEdit: (contact: Contact) => void;
  onArchive: (contact: Contact) => void;
  onRestore: (contact: Contact) => void;
}): ReactElement {
  const t = useTranslations('contacts');
  const manageable = session !== null && canManageLifecycle(session, contact);
  const archived = contact.archivedAt !== null;

  return (
    <div className={styles.rowActions}>
      {archived ? (
        <UnarchiveButton contact={contact} enabled={manageable} onRestore={onRestore} />
      ) : (
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t('edit')}
          onClick={() => onEdit(contact)}
        >
          <PencilIcon />
        </button>
      )}
      {!archived && manageable ? (
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t('archive')}
          onClick={() => onArchive(contact)}
        >
          <TrashIcon />
        </button>
      ) : null}
    </div>
  );
}

function UnarchiveButton({
  contact,
  enabled,
  onRestore,
}: {
  contact: Contact;
  enabled: boolean;
  onRestore: (contact: Contact) => void;
}): ReactElement | null {
  const t = useTranslations('contacts');
  if (!enabled) {
    return null;
  }
  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={t('restore')}
      onClick={() => onRestore(contact)}
    >
      <UnarchiveIcon />
    </button>
  );
}

export function TrashIcon(): ReactElement {
  return (
    <svg className={styles.solidIcon} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="#67e8f9" d="M4 7.2h16v2.4H4z" />
      <path fill="#3b82f6" d="M6.2 9.4h11.6V19a2 2 0 0 1-2 2H8.2a2 2 0 0 1-2-2z" />
      <path fill="#67e8f9" d="M9 4.2h6v2.2H9z" />
      <path fill="#67e8f9" d="M10.2 2.6h3.6v1.8h-3.6z" />
      <rect fill="#f8fafc" x="8.6" y="12" width="1.5" height="6.2" rx="0.7" />
      <rect fill="#f8fafc" x="11.25" y="12" width="1.5" height="6.2" rx="0.7" />
      <rect fill="#f8fafc" x="13.9" y="12" width="1.5" height="6.2" rx="0.7" />
    </svg>
  );
}

function UnarchiveIcon(): ReactElement {
  return (
    <svg className={styles.solidIcon} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="#16a34a" d="M4 11h12l3 3v6H4z" />
      <path fill="#22c55e" d="M4 11h12v9H4z" />
      <path fill="#14532d" d="M7 15.2h6v1.6H7z" />
      <path fill="#facc15" d="M8.2 9.5h3.6V4.2h2.4L10 1.2 5.8 4.2h2.4z" />
    </svg>
  );
}

function PencilIcon(): ReactElement {
  return (
    <svg className={styles.solidIcon} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="#f5b942" d="M14.2 3.2l6.6 6.6-9.4 9.4-6.6-6.6z" />
      <path fill="#ef4444" d="M18.4 2.1l3.5 3.5-2.1 2.1-3.5-3.5z" />
      <path fill="#fff" d="M16.6 4.2l3.2 3.2-1.2 1.2-3.2-3.2z" />
      <path fill="#111827" d="M3.4 17.2l3.4 3.4-4.6 1.2z" />
      <path fill="#f8fafc" d="M5.6 15.4l3 3-1.5 1.6-3-3z" />
    </svg>
  );
}
