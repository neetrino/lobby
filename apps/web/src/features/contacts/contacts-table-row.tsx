'use client';

import { useTranslations } from 'next-intl';
import type { KeyboardEvent, ReactElement } from 'react';

import { ContactAvatar, OwnerAvatar, TypeBadge } from './contact-avatar';
import { Checkbox } from '../../ui/checkbox/checkbox';
import type { Contact } from './contact';
import { formatContactStamp } from './contact-format';
import { useContactsListUi } from './contacts-list-ui';
import styles from './contacts.module.css';
import tableStyles from './contacts-table.module.css';

export function ContactRow({
  contact,
  locale,
  picked,
  open,
  onToggle,
  onOpen,
}: {
  contact: Contact;
  locale: string;
  picked: boolean;
  open: boolean;
  onToggle: () => void;
  onOpen: (contact: Contact) => void;
}): ReactElement {
  const archived = contact.archivedAt !== null;
  return (
    <tr
      className={rowClass(picked || open, archived)}
      tabIndex={0}
      onClick={(event) => openRow(event.target, contact, onOpen)}
      onKeyDown={(event) => openRowKey(event, contact, onOpen)}
    >
      <CheckCell contact={contact} picked={picked} onToggle={onToggle} />
      <NameCell contact={contact} archived={archived} />
      <OptionalCells contact={contact} locale={locale} archived={archived} />
    </tr>
  );
}

function openRow(target: EventTarget, contact: Contact, onOpen: (contact: Contact) => void): void {
  if (target instanceof Element && target.closest('input, label, button, a')) return;
  onOpen(contact);
}

function openRowKey(
  event: KeyboardEvent<HTMLTableRowElement>,
  contact: Contact,
  onOpen: (contact: Contact) => void,
): void {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  onOpen(contact);
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
    <td className={styles.checkCol} onClick={(event) => event.stopPropagation()}>
      <Checkbox checked={picked} label={t('selectRow', { name: contact.name })} onChange={onToggle} />
    </td>
  );
}

function NameCell({
  contact,
  archived,
}: {
  contact: Contact;
  archived: boolean;
}): ReactElement {
  const className = archived
    ? `${styles.nameButton} ${tableStyles.archivedName}`
    : styles.nameButton;
  return (
    <td className={styles.nameCol}>
      <div className={tableStyles.identity}>
        <ContactAvatar name={contact.name} type={contact.type} id={contact.id} />
        <div className={className}>
          <strong>{contact.name}</strong>
          <TypeBadge type={contact.type} />
        </div>
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
      {ui.columns.status ? (
        <StatusCell
          archived={archived}
          label={archived ? t('status.archived') : t('status.active')}
        />
      ) : null}
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
      <span className={archived ? tableStyles.statusArchived : tableStyles.statusActive}>
        {label}
      </span>
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
  const names = [
    archived ? tableStyles.archivedRow : '',
    selected ? styles.selectedRow : '',
  ].filter((name) => name !== '');
  return names.length === 0 ? undefined : names.join(' ');
}
