'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { X } from 'lucide-react';

import { Checkbox } from '../../ui/checkbox/checkbox';
import type { Contact, ContactListFilters } from './contact';
import type { LifecycleAction } from './use-lifecycle-prompt';
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
  onAskLifecycle,
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
  onAskLifecycle: (contacts: readonly Contact[], action: LifecycleAction) => void;
}) {
  const t = useTranslations('contacts');
  const locale = useLocale();
  const selection = usePageSelection(rows);

  return (
    <section
      className={tableCardClass(selection.picked.length > 0)}
      aria-busy={pending}
    >
      <SelectionCard
        count={selection.picked.length}
        archived={filters.archived}
        onClear={selection.clear}
        onAction={() =>
          onAskLifecycle(selection.picked, filters.archived ? 'restore' : 'archive')
        }
      />
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
        {ui.columns.status ? <th className={styles.midCol}>{t('columns.status')}</th> : null}
        {ui.columns.created ? <th className={styles.midCol}>{t('columns.registered')}</th> : null}
      </tr>
    </thead>
  );
}

function SelectionCard({
  count,
  archived,
  onClear,
  onAction,
}: {
  count: number;
  archived: boolean;
  onClear: () => void;
  onAction: () => void;
}): ReactElement | null {
  const t = useTranslations('contacts');
  if (count === 0) return null;
  return (
    <div className={styles.selectionBar} role="status">
      <button
        type="button"
        className={archived ? styles.selectionRestore : styles.selectionAction}
        onClick={onAction}
      >
        {archived ? t('restoreCount', { count }) : t('deleteCount', { count })}
      </button>
      <button
        type="button"
        className={styles.selectionClose}
        aria-label={t('clearSelection')}
        onClick={onClear}
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
}

function tableCardClass(picked: boolean): string {
  const names = [`${styles.tableCard} ${glass.panel} ${glass.soft}`];
  if (picked) names.push(styles.tableCardPicked);
  return names.join(' ');
}
