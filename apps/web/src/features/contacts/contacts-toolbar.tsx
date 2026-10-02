'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import type { ContactListFilters } from './contact';
import styles from './contacts.module.css';

const SEARCH_DEBOUNCE_MS = 300;

export function ContactsToolbar({
  filters,
  onChange,
}: {
  filters: ContactListFilters;
  onChange: (filters: ContactListFilters) => void;
}) {
  const t = useTranslations('contacts');
  const [search, setSearch] = useState(filters.search);
  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const current = filtersRef.current;
      const nextSearch = search.trim();
      if (nextSearch !== current.search) {
        onChange({ ...current, search: nextSearch });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [onChange, search]);

  return (
    <div className={styles.toolbar}>
      <div className={styles.segments} role="group" aria-label={t('status.active')}>
        <button
          type="button"
          className={filters.archived ? styles.segment : styles.segmentActive}
          onClick={() => onChange({ ...filters, archived: false })}
        >
          {t('active')}
        </button>
        <button
          type="button"
          className={filters.archived ? styles.segmentActive : styles.segment}
          onClick={() => onChange({ ...filters, archived: true })}
        >
          {t('archived')}
        </button>
      </div>
      <label className={styles.search}>
        <span className={styles.srOnly}>{t('searchPlaceholder')}</span>
        <input
          value={search}
          maxLength={100}
          placeholder={t('searchPlaceholder')}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <label>
        <span className={styles.srOnly}>{t('sortAsc')}</span>
        <select
          value={filters.sort}
          onChange={(event) =>
            onChange({ ...filters, sort: event.target.value === 'desc' ? 'desc' : 'asc' })
          }
        >
          <option value="asc">{t('sortAsc')}</option>
          <option value="desc">{t('sortDesc')}</option>
        </select>
      </label>
      <label>
        <span className={styles.srOnly}>{t('pageSize')}</span>
        <select
          value={filters.limit}
          onChange={(event) => onChange({ ...filters, limit: pageLimit(event.target.value) })}
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </label>
      <button
        type="button"
        className={styles.secondaryButton}
        onClick={() => {
          setSearch('');
          onChange({ search: '', archived: false, sort: 'asc', limit: 50 });
        }}
      >
        {t('clearFilters')}
      </button>
    </div>
  );
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
