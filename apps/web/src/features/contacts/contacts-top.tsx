'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import Link from 'next/link';

import { SignOutButton } from '../auth/sign-out-button';
import type { ContactListFilters, SessionPrincipal } from './contact';
import { shortId } from './contact-format';
import { LanguageSwitch } from './language-switch';
import styles from './contacts-top.module.css';

export function ContactsTop({
  filters,
  session,
  search,
  activeCount,
  duplicateCount,
  onSearch,
  onChange,
  onCreate,
  onExport,
}: {
  filters: ContactListFilters;
  session: SessionPrincipal | null;
  search: string;
  activeCount: number | null;
  duplicateCount: number;
  onSearch: (search: string) => void;
  onChange: (filters: ContactListFilters) => void;
  onCreate: () => void;
  onExport: () => Promise<void>;
}) {
  const t = useTranslations('contacts');
  const locale = useLocale();

  return (
    <>
      <TopBar search={search} session={session} onSearch={onSearch} onCreate={onCreate} />
      <div className={styles.context}>
        <nav className={styles.crumbs} aria-label={t('homeCrumb')}>
          <Link href={`/${locale}`}>
            <HomeIcon />
            {t('homeCrumb')}
          </Link>
          <span aria-hidden="true">›</span>
          <strong>{t('pageTitle')}</strong>
        </nav>
        {session === null ? null : (
          <span className={styles.tenant} title={session.tenant.id}>
            <i />
            {t('tenant', { id: shortId(session.tenant.id) })}
          </span>
        )}
      </div>
      <TitleCard
        filters={filters}
        activeCount={activeCount}
        duplicateCount={duplicateCount}
        onChange={onChange}
        onCreate={onCreate}
        onExport={onExport}
      />
    </>
  );
}

function TopBar({
  search,
  session,
  onSearch,
  onCreate,
}: {
  search: string;
  session: SessionPrincipal | null;
  onSearch: (search: string) => void;
  onCreate: () => void;
}) {
  const t = useTranslations('contacts');
  const locale = useLocale();
  return (
    <header className={styles.bar}>
      <label className={styles.headerSearch}>
        <SearchIcon />
        <span className={styles.srOnly}>{t('headerSearch')}</span>
        <input
          value={search}
          maxLength={100}
          placeholder={t('headerSearch')}
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>
      <span className={styles.branch}>
        <StoreIcon />
        {t('branch')}
      </span>
      <button type="button" className={styles.headerCreate} onClick={onCreate}>
        {t('headerCreate')}
      </button>
      <span className={styles.bell} aria-hidden="true">
        <BellIcon />
      </span>
      <div className={styles.account}>
        {session?.user.role === 'OWNER' || session?.user.role === 'ADMIN' ? (
          <Link className={styles.teamLink} href={`/${locale}/settings/team`}>
            {t('team')}
          </Link>
        ) : null}
        <LanguageSwitch />
        <UserChip session={session} />
        {session === null ? null : <SignOutButton className={styles.signOut} />}
      </div>
    </header>
  );
}

function TitleCard({
  filters,
  activeCount,
  duplicateCount,
  onChange,
  onCreate,
  onExport,
}: {
  filters: ContactListFilters;
  activeCount: number | null;
  duplicateCount: number;
  onChange: (filters: ContactListFilters) => void;
  onCreate: () => void;
  onExport: () => Promise<void>;
}) {
  const t = useTranslations('contacts');
  return (
    <section className={styles.titleCard}>
      <div className={styles.titleCopy}>
        <div className={styles.titleLine}>
          <h1>{t('pageTitle')}</h1>
          {activeCount === null ? null : (
            <span className={styles.activeBadge}>{t('activeCount', { count: activeCount })}</span>
          )}
          {duplicateCount === 0 ? null : (
            <span className={styles.duplicateBadge}>
              <i aria-hidden="true" />
              {t('duplicateCount', { count: duplicateCount })}
            </span>
          )}
        </div>
        <p>{t('pageDescription')}</p>
      </div>
      <TitleActions filters={filters} onChange={onChange} onCreate={onCreate} onExport={onExport} />
    </section>
  );
}

function TitleActions({
  filters,
  onChange,
  onCreate,
  onExport,
}: {
  filters: ContactListFilters;
  onChange: (filters: ContactListFilters) => void;
  onCreate: () => void;
  onExport: () => Promise<void>;
}) {
  const t = useTranslations('contacts');
  const [exporting, setExporting] = useState(false);

  async function exportCsv(): Promise<void> {
    setExporting(true);
    try {
      await onExport();
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={styles.titleActions}>
      <div className={styles.segments} role="group" aria-label={t('status.active')}>
        <button
          type="button"
          className={filters.archived ? styles.segment : styles.segmentActive}
          onClick={() => onChange({ ...filters, archived: false })}
        >
          <PeopleIcon />
          {t('active')}
        </button>
        <button
          type="button"
          className={filters.archived ? styles.segmentActive : styles.segment}
          onClick={() => onChange({ ...filters, archived: true })}
        >
          <ArchiveIcon />
          {t('archived')}
        </button>
      </div>
      <button
        type="button"
        className={styles.exportButton}
        disabled={exporting}
        onClick={() => void exportCsv()}
      >
        <DownloadIcon />
        {t('csv')}
      </button>
      <button type="button" className={styles.create} onClick={onCreate}>
        {t('createShort')}
        <CaretIcon />
      </button>
    </div>
  );
}

function UserChip({ session }: { session: SessionPrincipal | null }) {
  const t = useTranslations('contacts');
  if (session === null) {
    return null;
  }
  const role = t(`role.${session.user.role}`);
  return (
    <span className={styles.user}>
      <span className={styles.avatar} aria-hidden="true">
        {role.slice(0, 1)}
      </span>
      <span>
        <strong>{role}</strong>
        <small>Lobby</small>
      </span>
    </span>
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

function StoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10h16v9H4zM3 10l2-5h14l2 5" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1 2H5z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  );
}

function CaretIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="2.2" />
      <circle cx="16" cy="9" r="1.8" />
      <path d="M4.5 17c.5-2.4 2.3-3.6 4.5-3.6s4 1.2 4.5 3.6" />
      <path d="M14 13.6c1.2-.4 2.4-.3 3.4.4 1 .9 1.5 2 1.7 3" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16v4H4z" />
      <path d="M6 9v9h12V9" />
      <path d="M12 11v5" />
      <path d="M9.5 14.5L12 17l2.5-2.5" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v10" />
      <path d="M8 10l4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 11l8-7 8 7v8H4z" />
    </svg>
  );
}
