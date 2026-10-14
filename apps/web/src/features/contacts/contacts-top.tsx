'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import Link from 'next/link';

import glass from '../../ui/glass/glass.module.css';
import styles from './contacts-top.module.css';

export function ContactsTop({
  activeCount,
  duplicateCount,
  onCreate,
}: {
  activeCount: number | null;
  duplicateCount: number;
  onCreate: () => void;
}) {
  const t = useTranslations('contacts');
  const locale = useLocale();
  return (
    <>
      <TopBar />
      <div className={styles.context}>
        <nav className={styles.crumbs} aria-label={t('homeCrumb')}>
          <Link href={`/${locale}`}>
            <HomeIcon />
            {t('homeCrumb')}
          </Link>
          <span aria-hidden="true">›</span>
          <strong>{t('pageTitle')}</strong>
        </nav>
      </div>
      <PageHeader activeCount={activeCount} duplicateCount={duplicateCount} onCreate={onCreate} />
    </>
  );
}

function TopBar() {
  const t = useTranslations('contacts');
  return (
    <header className={`${styles.bar} ${glass.soft}`}>
      <span className={styles.branch}>
        <StoreIcon />
        {t('branch')}
      </span>
    </header>
  );
}

function PageHeader({
  activeCount,
  duplicateCount,
  onCreate,
}: {
  activeCount: number | null;
  duplicateCount: number;
  onCreate: () => void;
}) {
  const t = useTranslations('contacts');
  return (
    <section className={styles.pageHead}>
      <div>
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
      <button type="button" className={styles.create} onClick={onCreate}>
        {t('createShort')}
      </button>
    </section>
  );
}

function HomeIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 11l8-7 8 7v8H4z" />
    </svg>
  );
}

function StoreIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10h16v9H4zM3 10l2-5h14l2 5" />
    </svg>
  );
}
