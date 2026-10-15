'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Checkbox } from '../../ui/checkbox/checkbox';
import type { Contact, ContactListFilters } from './contact';
import { useContactsListUi } from './contacts-list-ui';
import { ContactPager } from './contacts-table-pager';
import { ContactRow } from './contacts-table-row';
import glass from '../../ui/glass/glass.module.css';
import styles from './contacts.module.css';
import { usePageSelection } from './use-page-selection';

export function ContactsTable({
  rows,
  selectedId,
  status,
  pending,
  nextCursor,
  filters,
  total,
  page,
  onOpen,
  onPage,
}: {
  rows: readonly Contact[];
  selectedId: string | null;
  status: 'loading' | 'ready' | 'error';
  pending: boolean;
  nextCursor: string | null;
  filters: ContactListFilters;
  total: number | null;
  page: number;
  onOpen: (contact: Contact) => void;
  onPage: (page: number) => void;
}) {
  const t = useTranslations('contacts');
  const locale = useLocale();
  const selection = usePageSelection(rows);

  return (
    <section className={`${styles.tableCard} ${glass.panel} ${glass.soft}`} aria-busy={pending}>
      <ContactGrid
        rows={rows}
        locale={locale}
        selectedId={selectedId}
        allPicked={selection.allPicked}
        somePicked={selection.somePicked}
        isPicked={selection.isPicked}
        onTogglePage={selection.togglePage}
        onToggle={selection.toggle}
        onOpen={onOpen}
      />
      {status === 'ready' && rows.length === 0 ? <p className={styles.note}>{t('empty')}</p> : null}
      <ContactPager
        page={page}
        total={total}
        limit={filters.limit}
        hasNext={nextCursor !== null}
        onPage={onPage}
      />
    </section>
  );
}

function ContactGrid({
  rows,
  locale,
  selectedId,
  allPicked,
  somePicked,
  isPicked,
  onTogglePage,
  onToggle,
  onOpen,
}: {
  rows: readonly Contact[];
  locale: string;
  selectedId: string | null;
  allPicked: boolean;
  somePicked: boolean;
  isPicked: (id: string) => boolean;
  onTogglePage: () => void;
  onToggle: (id: string) => void;
  onOpen: (contact: Contact) => void;
}): ReactElement {
  const t = useTranslations('contacts');
  return (
    <table className={styles.table}>
      <caption className={styles.srOnly}>{t('title')}</caption>
      <ContactHead allPicked={allPicked} somePicked={somePicked} onTogglePage={onTogglePage} />
      <tbody>
        {rows.map((contact) => (
          <ContactRow
            key={contact.id}
            contact={contact}
            locale={locale}
            picked={isPicked(contact.id)}
            open={contact.id === selectedId}
            onToggle={() => onToggle(contact.id)}
            onOpen={onOpen}
          />
        ))}
      </tbody>
    </table>
  );
}

function ContactHead({
  allPicked,
  somePicked,
  onTogglePage,
}: {
  allPicked: boolean;
  somePicked: boolean;
  onTogglePage: () => void;
}): ReactElement {
  const t = useTranslations('contacts');
  const ui = useContactsListUi();
  return (
    <thead>
      <tr>
        <th className={styles.checkCol}>
          <Checkbox
            checked={allPicked}
            indeterminate={somePicked}
            label={t('selectAll')}
            onChange={onTogglePage}
          />
        </th>
        <th className={styles.nameCol}>{t('columns.name')}</th>
        {ui.columns.details ? <th>{t('columns.details')}</th> : null}
        {ui.columns.owner ? <th>{t('columns.owner')}</th> : null}
        {ui.columns.status ? <th>{t('columns.status')}</th> : null}
        {ui.columns.created ? <th>{t('columns.registered')}</th> : null}
      </tr>
    </thead>
  );
}
