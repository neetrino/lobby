'use client';

import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { ContactAvatar, OwnerAvatar, TypeBadge } from './contact-avatar';
import type { Contact, SessionPrincipal } from './contact';
import { ContactRowActions } from './contact-row-actions';
import { formatContactStamp } from './contact-format';
import { useContactsListUi } from './contacts-list-ui';
import styles from './contacts.module.css';
import tableStyles from './contacts-table.module.css';

export function ContactRow({
  contact,
  locale,
  picked,
  open,
  session,
  onToggle,
  onOpen,
  onEdit,
  onArchive,
  onRestore,
}: {
  contact: Contact;
  locale: string;
  picked: boolean;
  open: boolean;
  session: SessionPrincipal | null;
  onToggle: () => void;
  onOpen: (contact: Contact) => void;
  onEdit: (contact: Contact) => void;
  onArchive: () => void;
  onRestore: () => void;
}): ReactElement {
  const archived = contact.archivedAt !== null;
  return (
    <tr className={rowClass(picked || open, archived)}>
      <CheckCell contact={contact} picked={picked} onToggle={onToggle} />
      <NameCell contact={contact} archived={archived} onOpen={onOpen} />
      <OptionalCells contact={contact} locale={locale} archived={archived} />
      <td>
        <ContactRowActions
          contact={contact}
          session={session}
          onView={onOpen}
          onEdit={onEdit}
          onArchive={onArchive}
          onRestore={onRestore}
        />
      </td>
    </tr>
  );
}

function CheckCell({
  contact,
  picked,
  onToggle,
}: {
  contact: Contact;
  picked: boolean;
  onToggle: () => void;
}): ReactElement {
  const t = useTranslations('contacts');
  return (
    <td className={styles.checkCol}>
      <input
        type="checkbox"
        checked={picked}
        aria-label={t('selectRow', { name: contact.name })}
        onChange={onToggle}
      />
    </td>
  );
}

function NameCell({
  contact,
  archived,
  onOpen,
}: {
  contact: Contact;
  archived: boolean;
  onOpen: (contact: Contact) => void;
}): ReactElement {
  const className = archived ? `${styles.nameButton} ${tableStyles.archivedName}` : styles.nameButton;
  return (
    <td className={styles.nameCol}>
      <div className={tableStyles.identity}>
        <ContactAvatar name={contact.name} type={contact.type} id={contact.id} />
        <button type="button" className={className} onClick={() => onOpen(contact)}>
          <strong>{contact.name}</strong>
          <TypeBadge type={contact.type} />
        </button>
      </div>
    </td>
  );
}

function OptionalCells({
  contact,
  locale,
  archived,
}: {
  contact: Contact;
  locale: string;
  archived: boolean;
}): ReactElement {
  const t = useTranslations('contacts');
  const ui = useContactsListUi();
  const stamp = formatContactStamp(contact.createdAt, locale);
  return (
    <>
      {ui.columns.details ? <DetailsCell contact={contact} /> : null}
      {ui.columns.owner ? <OwnerCell name={contact.ownerName} /> : null}
      {ui.columns.status ? <StatusCell archived={archived} label={archived ? t('status.archived') : t('status.active')} /> : null}
      {ui.columns.created ? <CreatedCell date={stamp.date} time={stamp.time} /> : null}
    </>
  );
}

function DetailsCell({ contact }: { contact: Contact }): ReactElement {
  return (
    <td>
      <div className={tableStyles.lines}>
        <span>{contact.email ?? '—'}</span>
        <span>{contact.phone ?? '—'}</span>
      </div>
    </td>
  );
}

function OwnerCell({ name }: { name: string }): ReactElement {
  return (
    <td>
      <span className={tableStyles.owner}>
        <OwnerAvatar name={name} />
        <span>{name}</span>
      </span>
    </td>
  );
}

function StatusCell({ archived, label }: { archived: boolean; label: string }): ReactElement {
  return (
    <td>
      <span className={archived ? tableStyles.statusArchived : tableStyles.statusActive}>{label}</span>
    </td>
  );
}

function CreatedCell({ date, time }: { date: string; time: string }): ReactElement {
  return (
    <td>
      <div className={tableStyles.stamp}>
        <span>{date}</span>
        <small>{time}</small>
      </div>
    </td>
  );
}

function rowClass(selected: boolean, archived: boolean): string | undefined {
  const names = [archived ? tableStyles.archivedRow : '', selected ? styles.selectedRow : ''].filter(
    (name) => name !== '',
  );
  return names.length === 0 ? undefined : names.join(' ');
}
