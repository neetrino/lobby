'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';

import type { Contact, ContactListFilters, SessionPrincipal } from './contact';
import { ColumnsMenu, DensitySwitch, ExportButton } from './contacts-toolbar-menus';
import { FilterMenu } from '../../ui/filter-menu/filter-menu';
import { SegmentedControl } from '../../ui/segmented-control/segmented-control';
import glass from '../../ui/glass/glass.module.css';
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
  rows,
  session,
  onSearch,
  onChange,
  onExport,
}: {
  filters: ContactListFilters;
  search: string;
  rows: readonly Contact[];
  session: SessionPrincipal | null;
  onSearch: (search: string) => void;
  onChange: (filters: ContactListFilters) => void;
  onExport: () => Promise<void>;
}) {
  return (
    <div className={`${styles.toolbar} ${styles.glassTop} ${glass.panel} ${glass.soft}`}>
      <SearchField search={search} onSearch={onSearch} />
      <ListFilters filters={filters} rows={rows} session={session} onChange={onChange} />
      <div className={styles.toolbarControls}>
        <DensitySwitch />
        <ExportButton onExport={onExport} />
        <ColumnsMenu />
      </div>
    </div>
  );
}

function ListFilters({
  filters,
  rows,
  session,
  onChange,
}: {
  filters: ContactListFilters;
  rows: readonly Contact[];
  session: SessionPrincipal | null;
  onChange: (filters: ContactListFilters) => void;
}): ReactElement {
  const t = useTranslations('contacts');
  const owners = ownerChoices(rows, session, filters.owner);
  return (
    <>
      <ArchiveSwitch
        archived={filters.archived}
        onChange={(archived) => onChange({ ...filters, archived })}
      />
      <FilterMenu
        label={t('filterType')}
        value={filters.type}
        options={[
          { value: 'all', label: t('typeAll') },
          { value: 'person', label: t('type.person') },
          { value: 'organization', label: t('type.organization') },
        ]}
        onChange={(type) => onChange({ ...filters, type: contactType(type) })}
      />
      <OwnerSortFilters filters={filters} owners={owners} onChange={onChange} />
    </>
  );
}

function OwnerSortFilters({
  filters,
  owners,
  onChange,
}: {
  filters: ContactListFilters;
  owners: ReadonlyArray<{ id: string; name: string }>;
  onChange: (filters: ContactListFilters) => void;
}): ReactElement {
  const t = useTranslations('contacts');
  return (
    <>
      <FilterMenu
        label={t('filterOwner')}
        value={filters.owner}
        options={[
          { value: '', label: t('ownerAll') },
          ...owners.map((owner) => ({ value: owner.id, label: owner.name })),
        ]}
        onChange={(owner) => onChange({ ...filters, owner })}
      />
      <FilterMenu
        label={t('filterSort')}
        value={filters.sort}
        options={[
          { value: 'asc', label: t('sortAsc') },
          { value: 'desc', label: t('sortDesc') },
        ]}
        onChange={(sort) => onChange({ ...filters, sort: sort === 'desc' ? 'desc' : 'asc' })}
      />
    </>
  );
}

function ArchiveSwitch({
  archived,
  onChange,
}: {
  archived: boolean;
  onChange: (archived: boolean) => void;
}): ReactElement {
  const t = useTranslations('contacts');
  return (
    <SegmentedControl
      label={t('status.active')}
      value={archived ? 'archived' : 'active'}
      options={[
        { value: 'active', label: (<><PeopleIcon />{t('active')}</>) },
        { value: 'archived', label: (<><ArchiveIcon />{t('archived')}</>) },
      ]}
      onChange={(value) => onChange(value === 'archived')}
    />
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
        aria-label={t('searchContacts')}
        placeholder={t('searchContacts')}
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

function ownerChoices(
  rows: readonly Contact[],
  session: SessionPrincipal | null,
  selected: string,
): Array<{ id: string; name: string }> {
  const names = new Map<string, string>();
  if (session !== null) {
    names.set(session.user.id, session.user.name.trim() || session.user.role);
  }
  for (const row of rows) {
    const name = row.ownerName.trim();
    if (name.length > 0) {
      names.set(row.ownerUserId, name);
    }
  }
  if (selected.length > 0 && !names.has(selected)) {
    names.set(selected, selected);
  }
  return [...names]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function contactType(value: string): ContactListFilters['type'] {
  if (value === 'person' || value === 'organization') {
    return value;
  }
  return 'all';
}

function PeopleIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="2.2" />
      <circle cx="16" cy="9" r="1.8" />
      <path d="M4.5 17c.5-2.4 2.3-3.6 4.5-3.6s4 1.2 4.5 3.6" />
      <path d="M14 13.6c1.2-.4 2.4-.3 3.4.4 1 .9 1.5 2 1.7 3" />
    </svg>
  );
}

function ArchiveIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16v4H4z" />
      <path d="M6 9v9h12V9" />
      <path d="M10 13h4" />
    </svg>
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
