'use client';

import { useLocale, useTranslations } from 'next-intl';

import { ContactAvatar, OwnerMark, TypeBadge } from './contact-avatar';
import type { Contact, SessionPrincipal } from './contact';
import { formatContactStamp, shortId } from './contact-format';
import { SelectionBar } from './contacts-selection-bar';
import styles from './contacts.module.css';
import tableStyles from './contacts-table.module.css';
import { usePageSelection } from './use-page-selection';

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
  onArchive: (contact: Contact) => Promise<void>;
  onRestore: (contact: Contact) => Promise<void>;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const t = useTranslations('contacts');
  const locale = useLocale();
  const selection = usePageSelection(rows);

  return (
    <section className={styles.tableCard} aria-busy={pending}>
      <SelectionBar
        selected={selection.picked}
        pageCount={rows.length}
        session={session}
        pending={pending}
        onArchive={onArchive}
        onRestore={onRestore}
        onClear={selection.clear}
      />
      <table className={styles.table}>
        <caption className={styles.srOnly}>{t('title')}</caption>
        <thead>
          <tr>
            <th className={tableStyles.check}>
              <PageCheckbox
                checked={selection.allPicked}
                indeterminate={selection.somePicked}
                label={t('selectAll')}
                onChange={selection.togglePage}
              />
            </th>
            <th>{t('columns.name')}</th>
            <th>{t('columns.details')}</th>
            <th>{t('columns.owner')}</th>
            <th>{t('columns.status')}</th>
            <th>{t('columns.registered')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((contact) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              locale={locale}
              picked={selection.isPicked(contact.id)}
              open={contact.id === selectedId}
              onToggle={() => selection.toggle(contact.id)}
              onOpen={onOpen}
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

function PageCheckbox({
  checked,
  indeterminate,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <input
      ref={(node) => {
        if (node !== null) {
          node.indeterminate = indeterminate;
        }
      }}
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={onChange}
    />
  );
}

function ContactRow({
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
}) {
  const t = useTranslations('contacts');
  const archived = contact.archivedAt !== null;
  const stamp = formatContactStamp(contact.createdAt, locale);

  return (
    <tr className={picked || open ? styles.selectedRow : undefined}>
      <td className={tableStyles.check}>
        <input
          type="checkbox"
          checked={picked}
          aria-label={t('selectRow', { name: contact.name })}
          onChange={onToggle}
        />
      </td>
      <td>
        <div className={tableStyles.identity}>
          <ContactAvatar name={contact.name} type={contact.type} id={contact.id} />
          <div>
            <button type="button" className={styles.nameButton} onClick={() => onOpen(contact)}>
              <strong>{contact.name}</strong>
              <TypeBadge type={contact.type} />
            </button>
            <small title={contact.id}>ID: {contact.id.slice(0, 18)}</small>
          </div>
        </div>
      </td>
      <td>
        <div>{contact.email ?? '—'}</div>
        <small>{contact.phone ?? '—'}</small>
      </td>
      <td>
        <span className={tableStyles.owner} title={contact.ownerUserId}>
          <OwnerMark />
          <span>{shortId(contact.ownerUserId)}</span>
        </span>
      </td>
      <td>
        <span className={archived ? tableStyles.statusArchived : tableStyles.statusActive}>
          {archived ? t('status.archived') : t('status.active')}
        </span>
      </td>
      <td>
        <div>{stamp.date}</div>
        <small>{stamp.time}</small>
      </td>
    </tr>
  );
}
