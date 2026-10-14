'use client';

import type { DashboardRangeDays, DashboardScope } from '@lobby/contracts';
import { useTranslations } from 'next-intl';

import { SegmentedControl } from '../../ui/segmented-control/segmented-control';
import { formatWhen } from './dashboard-layout';
import styles from './dashboard-toolbar.module.css';

const RANGES = [7, 30, 90] as const;
const SCOPES = ['all', 'mine'] as const;
const FRESH_MS = 60_000;

export function DashboardToolbar({
  range,
  scope,
  generatedAt,
  locale,
  onRange,
  onScope,
  onCustomize,
}: {
  range: DashboardRangeDays;
  scope: DashboardScope;
  generatedAt: string;
  locale: string;
  onRange: (range: DashboardRangeDays) => void;
  onScope: (scope: DashboardScope) => void;
  onCustomize: () => void;
}) {
  const t = useTranslations('dashboard');
  const updated = updatedLabel(t, generatedAt, locale);
  return (
    <header className={styles.toolbar}>
      <div>
        <h1>{t('title')}</h1>
        <p className={styles.subtitle}>
          {t('overviewLine')}
          <span aria-hidden="true"> · </span>
          {updated}
        </p>
      </div>
      <div className={styles.toolbarControls}>
        <button type="button" className={styles.ghost} onClick={onCustomize}>
          {t('customize')}
        </button>
        <SegmentedControl
          label={t('rangeLabel')}
          value={range}
          options={RANGES.map((days) => ({ value: days, label: t('rangeShort', { days }) }))}
          onChange={onRange}
        />
        <SegmentedControl
          label={t('scopeAll')}
          value={scope}
          options={SCOPES.map((value) => ({
            value,
            label: value === 'all' ? t('scopeAll') : t('scopeMine'),
          }))}
          onChange={onScope}
        />
      </div>
    </header>
  );
}

function updatedLabel(
  t: ReturnType<typeof useTranslations<'dashboard'>>,
  generatedAt: string,
  locale: string,
): string {
  const time = new Date(generatedAt).getTime();
  if (Number.isNaN(time) || Date.now() - time < FRESH_MS) {
    return t('updatedNow');
  }
  return t('updatedAt', { when: formatWhen(generatedAt, locale) });
}
