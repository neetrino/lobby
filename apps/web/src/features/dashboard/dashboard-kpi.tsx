'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactNode } from 'react';

import type { DashboardCard } from './dashboard-api';
import { widgetLabel } from './dashboard-layout';
import glass from '../../ui/glass/glass.module.css';
import styles from './dashboard.module.css';

export function kpiSpan(count: number): string {
  if (count <= 1) {
    return styles.span4 ?? '';
  }
  if (count === 2) {
    return styles.span6 ?? '';
  }
  if (count === 3) {
    return styles.span4 ?? '';
  }
  return styles.span3 ?? '';
}

export function KpiCard({ card, locale, span }: { card: DashboardCard; locale: string; span: string }) {
  const t = useTranslations('dashboard');
  return (
    <article className={`${styles.card} ${glass.panel} ${glass.soft} ${span}`}>
      <div className={styles.kpiTop}>
        <span className={styles.iconBox} aria-hidden="true">
          <KpiIcon name={card.key} />
        </span>
        <span className={styles.label}>{widgetLabel(t, card.key)}</span>
      </div>
      <strong className={styles.value}>{card.value}</strong>
      <Trend card={card} />
      {card.key.startsWith('contacts.') ? (
        <Link className={styles.quietAction} href={`/${locale}/contacts`}>
          {t('openContacts')}
        </Link>
      ) : null}
    </article>
  );
}

function Trend({ card }: { card: DashboardCard }) {
  const t = useTranslations('dashboard');
  if (card.trend === null) {
    return <span className={styles.trendQuiet}>{t('noDataYet')}</span>;
  }
  const rising = card.trend >= 0;
  return (
    <span className={rising ? styles.trendUp : styles.trendDown}>
      {rising ? '↑' : '↓'} {Math.abs(card.trend)}% {t('vsPrevious')}
    </span>
  );
}

function KpiIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24">
      {iconPath(name)}
    </svg>
  );
}

function iconPath(name: string): ReactNode {
  if (name === 'contacts.new') {
    return <path d="M12 5v14M5 12h14" />;
  }
  if (name.startsWith('reservations')) {
    return <path d="M5 5h14v15H5zM5 9h14M9 3v4M15 3v4" />;
  }
  return (
    <>
      <circle cx="12" cy="9" r="3" />
      <path d="M6 19c1.4-2.6 3.5-4 6-4s4.6 1.4 6 4" />
    </>
  );
}
