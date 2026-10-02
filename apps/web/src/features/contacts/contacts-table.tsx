'use client';

import { useLocale, useTranslations } from 'next-intl';

import { canManageLifecycle, type Contact, type SessionPrincipal } from './contact';
import { formatContactDate, shortId } from './contact-format';
import styles from './contacts.module.css';

export function ContactsTable({
  rows,
  selectedId,
  session,
  status,
  pending,
  nextCursor,
  hasPrevious,
  onOpen,
  onArchive,
  onRestore,
  onNext,
  onPrevious,
}: {
  rows: readonly Contact[];
  selectedId: string | null;
  session: SessionPrincipal | null;
  status: 'loading' | 'ready' | 'error';
  pending: boolean;
  nextCursor: string | null;
  hasPrevious: boolean;
  onOpen: (contact: Contact) => void;
  onArchive: (contact: Contact) => void;
  onRestore: (contact: Contact) => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const t = useTranslations('contacts');
  const locale = useLocale();

  return (
    <section className={styles.tableCard} aria-busy={pending}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>{t('title')}</caption>
        <thead>
          <tr>
            <th>{t('columns.name')}</th>
            <th>{t('columns.details')}</th>
            <th>{t('columns.owner')}</th>
            <th>{t('columns.status')}</th>
            <th>{t('columns.registered')}</th>
            <th>{t('columns.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((contact) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              locale={locale}
              selected={contact.id === selectedId}
              session={session}
              onOpen={onOpen}
              onArchive={onArchive}
              onRestore={onRestore}
            />
          ))}
        </tbody>
      </table>
      {status === 'ready' && rows.length === 0 ? <p className={styles.note}>{t('empty')}</p> : null}
      <footer className={styles.pager}>
        <span>{footerText(status, t, rows.length)}</span>
        <div>
          <button type="button" disabled={!hasPrevious} onClick={onPrevious}>
            {t('previousPage')}
          </button>
          <button type="button" disabled={nextCursor === null} onClick={onNext}>
            {t('nextPage')}
          </button>
        </div>
      </footer>
    </section>
  );
}

function footerText(
  status: 'loading' | 'ready' | 'error',
  t: ReturnType<typeof useTranslations<'contacts'>>,
  count: number,
): string {
  if (status === 'loading') {
    return t('loading');
  }
  if (status === 'ready') {
    return t('shown', { count });
  }
  return '';
}

function ContactRow({
  contact,
  locale,
  selected,
  session,
  onOpen,
  onArchive,
  onRestore,
}: {
  contact: Contact;
  locale: string;
  selected: boolean;
  session: SessionPrincipal | null;
  onOpen: (contact: Contact) => void;
  onArchive: (contact: Contact) => void;
  onRestore: (contact: Contact) => void;
}) {
  const t = useTranslations('contacts');
  const archived = contact.archivedAt !== null;
  const manageable = session !== null && canManageLifecycle(session, contact);

  return (
    <tr className={selected ? styles.selectedRow : undefined}>
      <td>
        <button type="button" className={styles.nameButton} onClick={() => onOpen(contact)}>
          <strong>{contact.name}</strong>
          <span>{t(`type.${contact.type}`)}</span>
        </button>
        <small title={contact.id}>{shortId(contact.id)}</small>
      </td>
      <td>
        <div>{contact.email ?? '—'}</div>
        <small>{contact.phone ?? '—'}</small>
      </td>
      <td title={contact.ownerUserId}>{shortId(contact.ownerUserId)}</td>
      <td>
        <span className={archived ? styles.badgeMuted : styles.badgeActive}>
          {archived ? t('status.archived') : t('status.active')}
        </span>
      </td>
      <td>{formatContactDate(contact.createdAt, locale)}</td>
      <td className={styles.actions}>
        <button type="button" onClick={() => onOpen(contact)}>
          {t('view')}
        </button>
        {manageable && !archived ? (
          <button type="button" onClick={() => onArchive(contact)}>
            {t('archive')}
          </button>
        ) : null}
        {manageable && archived ? (
          <button type="button" onClick={() => onRestore(contact)}>
            {t('restore')}
          </button>
        ) : null}
      </td>
    </tr>
  );
}
