'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';

import type { DashboardBoard } from './dashboard-api';
import styles from './dashboard-charts.module.css';
import glass from '../../ui/glass/glass.module.css';
import board from './dashboard.module.css';

const SERIES = ['created', 'updated', 'archived', 'invited', 'accepted'] as const;

type SeriesKey = (typeof SERIES)[number];
type TrendDay = NonNullable<DashboardBoard['activityTrend']>['days'][number];

export function ActivityTrend({ board: data, locale }: { board: DashboardBoard; locale: string }) {
  const t = useTranslations('dashboard');
  const days = data.activityTrend?.days;
  const series = days === undefined ? [] : seriesOf(days);
  const [tip, setTip] = useState<{ key: SeriesKey; day: TrendDay } | null>(null);
  if (days === undefined) {
    return null;
  }
  const max = Math.max(1, ...days.map((day) => dayTotal(day, series)));
  return (
    <section className={`${board.card} ${glass.panel} ${glass.soft} ${board.span12}`}>
      <div className={styles.head}>
        <h2>{t('charts.activityTitle')}</h2>
        <p className={styles.meta}>{t('range', { days: data.rangeDays })}</p>
        <p className={styles.meta}>{t('charts.activityMetric')}</p>
      </div>
      {dayTotalAll(days, series) === 0 ? (
        <p className={styles.zero}>{t('charts.activityZero')}</p>
      ) : (
        <>
          <SeriesLegend series={series} />
          <div className={styles.plot}>
            {days.map((day, index) => (
              <DayColumn
                key={day.date}
                day={day}
                series={series}
                max={max}
                showTick={index % tickStep(days.length) === 0}
                locale={locale}
                onPick={setTip}
              />
            ))}
          </div>
          <p className={styles.detail}>{tip === null ? t('charts.pick') : tipText(t, tip)}</p>
        </>
      )}
    </section>
  );
}

function SeriesLegend({ series }: { series: SeriesKey[] }) {
  const t = useTranslations('dashboard');
  return (
    <ul className={styles.legend}>
      {series.map((key) => (
        <li key={key}>
          <i className={`${styles.swatch} ${seriesClass(key)}`} aria-hidden="true" />
          {seriesLabel(t, key)}
        </li>
      ))}
    </ul>
  );
}

function DayColumn({
  day,
  series,
  max,
  showTick,
  locale,
  onPick,
}: {
  day: TrendDay;
  series: SeriesKey[];
  max: number;
  showTick: boolean;
  locale: string;
  onPick: (tip: { key: SeriesKey; day: TrendDay }) => void;
}) {
  return (
    <div className={styles.column}>
      <div className={styles.stack}>
        {dayTotal(day, series) === 0 ? <span className={styles.tick}>0</span> : null}
        {series.map((key) => (
          <Segment key={key} seriesKey={key} day={day} max={max} locale={locale} onPick={onPick} />
        ))}
      </div>
      <span className={styles.tick}>{showTick ? day.date.slice(5) : ''}</span>
    </div>
  );
}

function Segment({
  seriesKey,
  day,
  max,
  locale,
  onPick,
}: {
  seriesKey: SeriesKey;
  day: TrendDay;
  max: number;
  locale: string;
  onPick: (tip: { key: SeriesKey; day: TrendDay }) => void;
}) {
  const t = useTranslations('dashboard');
  const count = day[seriesKey];
  if (count === null || count === 0) {
    return null;
  }
  const href = seriesHref(locale, seriesKey);
  const className = `${styles.segment} ${seriesClass(seriesKey)}`;
  const style = { height: `${(count / max) * 100}%` };
  const label = t('charts.seriesCount', { series: seriesLabel(t, seriesKey), count, date: day.date });
  const pick = () => onPick({ key: seriesKey, day });
  if (href === null) {
    return (
      <button type="button" className={className} style={style} onMouseEnter={pick} onFocus={pick}>
        <span className={styles.srOnly}>{label}</span>
      </button>
    );
  }
  return (
    <Link href={href} className={className} style={style} onMouseEnter={pick} onFocus={pick}>
      <span className={styles.srOnly}>{label}</span>
    </Link>
  );
}

function seriesOf(days: TrendDay[]): SeriesKey[] {
  const first = days[0];
  if (first === undefined) {
    return [];
  }
  return SERIES.filter((key) => first[key] !== null);
}

function dayTotal(day: TrendDay, series: SeriesKey[]): number {
  return series.reduce((sum, key) => sum + (day[key] ?? 0), 0);
}

function dayTotalAll(days: TrendDay[], series: SeriesKey[]): number {
  return days.reduce((sum, day) => sum + dayTotal(day, series), 0);
}

function tickStep(length: number): number {
  return length > 16 ? Math.ceil(length / 8) : 1;
}

function seriesLabel(t: ReturnType<typeof useTranslations<'dashboard'>>, key: SeriesKey): string {
  switch (key) {
    case 'created':
      return t('charts.created');
    case 'updated':
      return t('charts.updated');
    case 'archived':
      return t('charts.archived');
    case 'invited':
      return t('charts.invited');
    case 'accepted':
      return t('charts.accepted');
  }
}

function seriesClass(key: SeriesKey): string {
  switch (key) {
    case 'created':
      return styles.created ?? '';
    case 'updated':
      return styles.updated ?? '';
    case 'archived':
      return styles.archived ?? '';
    case 'invited':
      return styles.invited ?? '';
    case 'accepted':
      return styles.accepted ?? '';
  }
}

function seriesHref(locale: string, key: SeriesKey): string | null {
  if (key === 'archived') {
    return `/${locale}/contacts?archived=true`;
  }
  if (key === 'created' || key === 'updated') {
    return `/${locale}/contacts`;
  }
  return null;
}

function tipText(
  t: ReturnType<typeof useTranslations<'dashboard'>>,
  tip: { key: SeriesKey; day: TrendDay },
): string {
  return t('charts.seriesCount', {
    series: seriesLabel(t, tip.key),
    count: tip.day[tip.key] ?? 0,
    date: tip.day.date,
  });
}
