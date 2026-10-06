'use client';

import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import type { ContactListFilters } from './contact';
import styles from './contacts.module.css';

export function ContactPager({
  status,
  count,
  pageIndex,
  filters,
  activeCount,
  limit,
  hasPrevious,
  hasNext,
  onLimit,
  onPrevious,
  onNext,
}: {
  status: 'loading' | 'ready' | 'error';
  count: number;
  pageIndex: number;
  filters: ContactListFilters;
  activeCount: number | null;
  limit: ContactListFilters['limit'];
  hasPrevious: boolean;
  hasNext: boolean;
  onLimit: (limit: ContactListFilters['limit']) => void;
  onPrevious: () => void;
  onNext: () => void;
}): ReactElement {
  const t = useTranslations('contacts');
  return (
    <footer className={styles.pager}>
      <span>{pageSummary(status, t, count, pageIndex, filters, activeCount)}</span>
      <div className={styles.pagerTools}>
        <label className={styles.pageSize}>
          {t('rows')}
          <select
            aria-label={t('pageSize')}
            value={limit}
            onChange={(event) => onLimit(pageLimit(event.target.value))}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <button type="button" disabled={!hasPrevious} onClick={onPrevious}>
          {t('previousPage')}
        </button>
        <button type="button" disabled={!hasNext} onClick={onNext}>
          {t('nextPage')}
        </button>
      </div>
    </footer>
  );
}

function pageSummary(
  status: 'loading' | 'ready' | 'error',
  t: ReturnType<typeof useTranslations<'contacts'>>,
  count: number,
  pageIndex: number,
  filters: ContactListFilters,
  activeCount: number | null,
): string {
  if (status === 'loading') {
    return t('loading');
  }
  if (status !== 'ready') {
    return '';
  }
  const total = unfilteredTotal(filters, activeCount);
  if (count === 0 || total === null) {
    return t('results', { count });
  }
  const start = pageIndex * filters.limit + 1;
  return t('showingRange', { start, end: start + count - 1, total });
}

function unfilteredTotal(filters: ContactListFilters, activeCount: number | null): number | null {
  const narrowed = filters.archived || filters.search !== '' || filters.type !== 'all' || filters.owner !== '';
  if (activeCount === null || narrowed) {
    return null;
  }
  return activeCount;
}

function pageLimit(value: string): ContactListFilters['limit'] {
  if (value === '25') {
    return 25;
  }
  if (value === '100') {
    return 100;
  }
  return 50;
}
