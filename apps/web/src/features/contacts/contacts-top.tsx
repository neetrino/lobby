'use client';

import { useTranslations } from 'next-intl';

import styles from './contacts-top.module.css';

export function ContactsTop({
  activeCount,
  duplicateCount,
  onCreate,
  onDuplicates,
}: {
  activeCount: number | null;
  duplicateCount: number;
  onCreate: () => void;
  onDuplicates: () => void;
}) {
  return (
    <PageHeader
      activeCount={activeCount}
      duplicateCount={duplicateCount}
      onCreate={onCreate}
      onDuplicates={onDuplicates}
    />
  );
}

function PageHeader({
  activeCount,
  duplicateCount,
  onCreate,
  onDuplicates,
}: {
  activeCount: number | null;
  duplicateCount: number;
  onCreate: () => void;
  onDuplicates: () => void;
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
            <button type="button" className={styles.duplicateBadge} onClick={onDuplicates}>
              <i aria-hidden="true" />
              {t('duplicateCount', { count: duplicateCount })}
            </button>
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
