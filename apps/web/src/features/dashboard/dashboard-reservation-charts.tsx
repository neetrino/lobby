'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { DashboardBoard } from './dashboard-api';
import styles from './dashboard-charts.module.css';
import board from './dashboard.module.css';

type Load = NonNullable<DashboardBoard['reservationLoad']>;
type View = 'today' | 'tomorrow' | 'week';
type Hour = Load['today'][number];

export function ReservationCharts({ board: data }: { board: DashboardBoard }) {
  const load = data.reservationLoad;
  if (load === undefined) {
    return null;
  }
  return (
    <>
      <LoadChart load={load} generatedAt={data.generatedAt} />
      <OccupancyChart load={load} />
    </>
  );
}

function LoadChart({ load, generatedAt }: { load: Load; generatedAt: string }) {
  const t = useTranslations('dashboard');
  const [view, setView] = useState<View>('today');
  const [tip, setTip] = useState<Hour | null>(null);
  const points = load[view];
  const capacity = view === 'week' ? null : positive(load.capacity);
  const scale = Math.max(1, capacity ?? 0, ...points.map((point) => point.guests));
  const date = view === 'week' ? t('charts.week') : viewDate(generatedAt, view);
  return (
    <section className={`${board.card} ${board.span6}`}>
      <div className={styles.head}>
        <h2>{t('charts.loadTitle')}</h2>
        <p className={styles.meta}>{t(view === 'week' ? 'charts.loadWeekMetric' : 'charts.loadMetric')}</p>
      </div>
      <ViewToggle view={view} onChange={setView} />
      {points.length === 0 ? (
        <p className={styles.zero}>{t('charts.loadZero')}</p>
      ) : (
        <LoadBars points={points} scale={scale} capacity={capacity} date={date} tip={tip} onPick={setTip} />
      )}
    </section>
  );
}

function LoadBars({
  points,
  scale,
  capacity,
  date,
  tip,
  onPick,
}: {
  points: Hour[];
  scale: number;
  capacity: number | null;
  date: string;
  tip: Hour | null;
  onPick: (point: Hour) => void;
}) {
  const t = useTranslations('dashboard');
  const over = tip !== null && capacity !== null && tip.guests > capacity;
  return (
    <>
      <ul className={styles.legend}>
        <li>
          <i className={`${styles.swatch} ${styles.guest}`} aria-hidden="true" />
          {t('charts.guests')}
        </li>
        {capacity === null ? null : (
          <li>
            <i className={`${styles.swatch} ${styles.capacityKey}`} aria-hidden="true" />
            {t('charts.capacity')} {capacity}
          </li>
        )}
      </ul>
      <div className={styles.plot}>
        {points.map((point) => (
          <HourColumn key={point.hour} point={point} scale={scale} capacity={capacity} date={date} onPick={onPick} />
        ))}
      </div>
      <p className={styles.detail}>{tipText(t, tip, date, over)}</p>
    </>
  );
}

function HourColumn({
  point,
  scale,
  capacity,
  date,
  onPick,
}: {
  point: Hour;
  scale: number;
  capacity: number | null;
  date: string;
  onPick: (point: Hour) => void;
}) {
  const t = useTranslations('dashboard');
  const over = capacity !== null && point.guests > capacity;
  const label = t('charts.seriesCount', {
    series: `${hourLabel(point.hour)}${over ? ` ${t('charts.over')}` : ''}`,
    count: point.guests,
    date,
  });
  return (
    <div className={styles.column}>
      <div className={styles.stack}>
        {capacity === null ? null : (
          <span className={styles.capacityLine} style={{ bottom: `${(capacity / scale) * 100}%` }} />
        )}
        <button
          type="button"
          className={`${styles.segment} ${barClass(over, point.guests)}`}
          style={{ height: point.guests === 0 ? '8px' : `${(point.guests / scale) * 100}%` }}
          onMouseEnter={() => onPick(point)}
          onFocus={() => onPick(point)}
        >
          <span className={styles.srOnly}>{label}</span>
        </button>
      </div>
      <span className={styles.tick}>
        {hourLabel(point.hour)}
        {over ? ` · ${t('charts.over')}` : ''}
        {point.guests === 0 ? ' · 0' : ''}
      </span>
    </div>
  );
}

function OccupancyChart({ load }: { load: Load }) {
  const t = useTranslations('dashboard');
  const capacity = positive(load.capacity);
  return (
    <section className={`${board.card} ${board.span6}`}>
      <div className={styles.head}>
        <h2>{t('charts.occupancyTitle')}</h2>
        <p className={styles.meta}>{t('charts.today')}</p>
        <p className={styles.meta}>{t('charts.occupancyMetric')}</p>
      </div>
      {capacity === null ? <p className={styles.zero}>{t('charts.occupancyNoCapacity')}</p> : null}
      {capacity !== null && load.today.length === 0 ? (
        <p className={styles.zero}>
          {t('charts.occupancyZero')} · {t('charts.seats', { guests: 0, capacity })}
        </p>
      ) : null}
      {capacity === null
        ? null
        : load.today.map((point) => <OccupancyRow key={point.hour} point={point} capacity={capacity} />)}
    </section>
  );
}

function OccupancyRow({ point, capacity }: { point: Hour; capacity: number }) {
  const t = useTranslations('dashboard');
  const percent = Math.round((point.guests / capacity) * 100);
  const over = point.guests > capacity;
  return (
    <div className={styles.meter}>
      <span>{hourLabel(point.hour)}</span>
      <span className={styles.meterTrack}>
        <span
          className={over ? styles.meterFillOver : styles.meterFill}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </span>
      <span>
        {t('charts.seats', { guests: point.guests, capacity })} {t('charts.percent', { percent })}
        {over ? ` ${t('charts.over')}` : ''}
      </span>
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  const t = useTranslations('dashboard');
  const views: View[] = ['today', 'tomorrow', 'week'];
  return (
    <div className={styles.toggles} role="group" aria-label={t('charts.loadTitle')}>
      {views.map((item) => (
        <button
          key={item}
          type="button"
          className={item === view ? styles.toggleOn : styles.toggle}
          aria-pressed={item === view}
          onClick={() => onChange(item)}
        >
          {t(`charts.${item}`)}
        </button>
      ))}
    </div>
  );
}

function tipText(
  t: ReturnType<typeof useTranslations<'dashboard'>>,
  tip: Hour | null,
  date: string,
  over: boolean,
): string {
  if (tip === null) {
    return t('charts.pick');
  }
  const count = t('charts.seriesCount', { series: hourLabel(tip.hour), count: tip.guests, date });
  return over ? `${count} · ${t('charts.over')}` : count;
}

function barClass(over: boolean, guests: number): string {
  if (over) {
    return styles.over ?? '';
  }
  return (guests === 0 ? styles.quietBar : styles.guest) ?? '';
}

function positive(capacity: number | null): number | null {
  return capacity !== null && capacity > 0 ? capacity : null;
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

function viewDate(generatedAt: string, view: View): string {
  const now = new Date(generatedAt);
  if (Number.isNaN(now.getTime()) || view === 'week') {
    return view;
  }
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (view === 'tomorrow') {
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return day.toISOString().slice(0, 10);
}
