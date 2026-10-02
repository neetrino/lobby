'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import type { ContactListFilters } from './contact';
import styles from './contacts.module.css';

const SEARCH_DEBOUNCE_MS = 300;

export function useContactSearch(
  filters: ContactListFilters,
  onChange: (filters: ContactListFilters) => void,
): { search: string; setSearch: (search: string) => void } {
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

  return { search, setSearch };
}

export function ContactsToolbar({
  filters,
  search,
  onSearch,
  onChange,
}: {
  filters: ContactListFilters;
  search: string;
  onSearch: (search: string) => void;
  onChange: (filters: ContactListFilters) => void;
}) {
  const t = useTranslations('contacts');

  return (
    <div className={styles.toolbar}>
      <SearchField search={search} onSearch={onSearch} />
      <div className={styles.toolbarControls}>
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
          className={styles.clearFilters}
          onClick={() => {
            onSearch('');
            onChange({ search: '', archived: false, sort: 'asc', limit: 50 });
          }}
        >
          {t('clearFilters')}
        </button>
      </div>
    </div>
  );
}

function SearchField({ search, onSearch }: { search: string; onSearch: (search: string) => void }) {
  const t = useTranslations('contacts');
  return (
    <label className={styles.search}>
      <SearchIcon />
      <input
        value={search}
        maxLength={100}
        aria-label={t('searchPlaceholder')}
        placeholder={t('searchName')}
        onChange={(event) => onSearch(event.target.value)}
      />
      {search.length === 0 ? null : (
        <button
          type="button"
          className={styles.searchClear}
          aria-label={t('clearSearch')}
          onClick={() => onSearch('')}
        >
          ×
        </button>
      )}
    </label>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l4 4" />
    </svg>
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
