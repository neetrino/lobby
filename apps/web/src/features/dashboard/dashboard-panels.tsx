'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

import type { DashboardBoard } from './dashboard-api';
import { formatWhen, kindLabel, widgetLabel } from './dashboard-layout';
import styles from './dashboard.module.css';

export function WorkPanel({
  board,
  locale,
  wide,
}: {
  board: DashboardBoard;
  locale: string;
  wide: boolean;
}) {
  const t = useTranslations('dashboard');
  const groups = board.work.filter((group) => group.items.length > 0);
  const activity = board.activity;
  const quiet = groups.length === 0 && (activity === undefined || activity.items.length === 0);
  return (
    <section className={`${styles.card} ${wide ? styles.span12 : styles.work}`}>
      <h2>{t('work')}</h2>
      {quiet ? <CaughtUp locale={locale} /> : null}
      {groups.map((group) => (
        <div key={group.key}>
          <h3>{widgetLabel(t, group.key)}</h3>
          <ItemList
            locale={locale}
            items={group.items.map((item) => ({ id: item.id, label: item.label, href: item.href, when: item.detail }))}
          />
        </div>
      ))}
      {activity === undefined || quiet ? null : <Activity items={activity.items} locale={locale} />}
    </section>
  );
}

function CaughtUp({ locale }: { locale: string }) {
  const t = useTranslations('dashboard');
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon} aria-hidden="true">
        <CheckIcon />
      </span>
      <h3>{t('caughtUp')}</h3>
      <p>{t('caughtUpBody')}</p>
      <Link className={styles.emptyAction} href={`/${locale}/contacts`}>
        {t('openContacts')}
      </Link>
    </div>
  );
}

function Activity({
  items,
  locale,
}: {
  items: NonNullable<DashboardBoard['activity']>['items'];
  locale: string;
}) {
  const t = useTranslations('dashboard');
  return (
    <div>
      <h2>{t('activity')}</h2>
      {items.length === 0 ? (
        <p className={styles.quietLine}>{t('activityEmpty')}</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id}>
              <span>
                <small>{kindLabel(t, item.kind)}</small>
                <br />
                {item.href === null ? item.label : <Link href={`/${locale}${item.href}`}>{item.label}</Link>}
              </span>
              <small>{formatWhen(item.occurredAt, locale)}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemList({
  items,
  locale,
}: {
  items: Array<{ id: string; label: string; href: string | null; when: string }>;
  locale: string;
}) {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.id}>
          {item.href === null ? item.label : <Link href={`/${locale}${item.href}`}>{item.label}</Link>}
          <small>{formatWhen(item.when, locale)}</small>
        </li>
      ))}
    </ul>
  );
}

export function Snapshot({ board }: { board: DashboardBoard }) {
  const t = useTranslations('dashboard');
  const growth = board.analytics?.contactGrowth ?? null;
  const occupancy = board.analytics?.occupancy ?? null;
  return (
    <aside className={`${styles.card} ${styles.snapshot}`}>
      <h2>{t('analytics')}</h2>
      {growth === null ? null : <Growth growth={growth} />}
      {occupancy === null ? null : (
        <p className={styles.metric}>
          <span>{t('occupancy')}</span>
          <strong>
            {occupancy.occupied}/{occupancy.active}
          </strong>
        </p>
      )}
      {growth === null && occupancy === null ? <p className={styles.quietLine}>{t('noDataYet')}</p> : null}
    </aside>
  );
}

function Growth({
  growth,
}: {
  growth: { current: number; previous: number; trend: number | null };
}) {
  const t = useTranslations('dashboard');
  const max = Math.max(growth.current, growth.previous, 1);
  return (
    <>
      <div className={styles.bars} aria-hidden="true">
        <span style={{ height: `${(growth.previous / max) * 100}%` }} />
        <span className={styles.barNow} style={{ height: `${(growth.current / max) * 100}%` }} />
      </div>
      <p className={styles.metric}>
        <span>{t('contactGrowth')}</span>
        <strong>{growth.current}</strong>
        {growth.trend === null ? null : (
          <small className={growth.trend < 0 ? styles.trendDown : styles.trendUp}>{growth.trend}%</small>
        )}
      </p>
    </>
  );
}

export function ReservationRow({ board }: { board: DashboardBoard }) {
  const t = useTranslations('dashboard');
  const summary = board.reservations;
  if (summary === undefined) {
    return null;
  }
  return (
    <section className={`${styles.ops} ${styles.span12}`} aria-label={t('reservations')}>
      <Mini label={t('expectedGuests')} value={summary.expectedGuests} />
      <Mini label={t('pending')} value={summary.pendingConfirmations} />
      <Mini label={t('cancellations')} value={summary.cancellations} />
      <Mini
        label={t('tables')}
        value={summary.occupiedTables}
        detail={t('occupied', { occupied: summary.occupiedTables, active: summary.activeTables })}
      />
    </section>
  );
}

function Mini({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <article className={styles.card}>
      <span className={styles.label}>{label}</span>
      <strong className={styles.valueSmall}>{value}</strong>
      {detail === undefined ? null : <small className={styles.quietLine}>{detail}</small>}
    </article>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 12.5l2.2 2.2 4.8-5.2" />
    </svg>
  );
}
