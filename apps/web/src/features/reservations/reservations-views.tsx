'use client';

import { useTranslations } from 'next-intl';

import {
  formatTime,
  hourOf,
  type DiningTable,
  type ReservationSummary,
  type Venue,
} from './reservations-model';
import styles from './reservations.module.css';

type Names = {
  venues: Venue[];
  tables: DiningTable[];
  locale: string;
  onOpen: (id: string) => void;
};

export function ReservationViews({
  view,
  rows,
  names,
}: {
  view: 'list' | 'calendar' | 'timeline';
  rows: ReservationSummary[];
  names: Names;
}) {
  if (view === 'calendar') return <Calendar rows={rows} names={names} />;
  if (view === 'timeline') return <Timeline rows={rows} names={names} />;
  return <List rows={rows} names={names} />;
}

function List({ rows, names }: { rows: ReservationSummary[]; names: Names }) {
  const t = useTranslations('reservations');
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>{t('time')}</th>
          <th>{t('guest')}</th>
          <th>{t('party')}</th>
          <th>{t('status')}</th>
          <th>{t('location')}</th>
          <th>{t('table')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} onClick={() => names.onOpen(row.id)}>
            <td>{formatTime(row.startsAt, names.locale)}</td>
            <td>{row.customerName}</td>
            <td>{row.guestCount}</td>
            <td><StatusBadge status={row.status} /></td>
            <td>{venueName(names.venues, row.locationId)}</td>
            <td>{tableName(names.tables, row.tableId)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Calendar({ rows, names }: { rows: ReservationSummary[]; names: Names }) {
  return (
    <div className={styles.hours}>
      {hourRange(rows).map((hour) => (
        <section key={hour} className={styles.hour}>
          <h3>{String(hour).padStart(2, '0')}:00</h3>
          <div className={styles.hourCards}>
            {rows.filter((row) => hourOf(row.startsAt) === hour).map((row) => (
              <BookingCard key={row.id} row={row} names={names} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Timeline({ rows, names }: { rows: ReservationSummary[]; names: Names }) {
  const tables = timelineTables(rows, names.tables);
  const hours = hourRange(rows);
  return (
    <div className={styles.timeline}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th />
            {hours.map((hour) => <th key={hour}>{String(hour).padStart(2, '0')}</th>)}
          </tr>
        </thead>
        <tbody>
          {tables.map((table) => (
            <tr key={table.id}>
              <th>{table.name}</th>
              {hours.map((hour) => (
                <td key={hour}>
                  {rows
                    .filter((row) => row.tableId === table.id && hourOf(row.startsAt) === hour)
                    .map((row) => (
                      <button key={row.id} type="button" className={styles.chip} onClick={() => names.onOpen(row.id)}>
                        {formatTime(row.startsAt, names.locale)} {row.customerName}
                      </button>
                    ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BookingCard({ row, names }: { row: ReservationSummary; names: Names }) {
  return (
    <button type="button" className={styles.card} onClick={() => names.onOpen(row.id)}>
      <strong>{formatTime(row.startsAt, names.locale)} {row.customerName}</strong>
      <span>{row.guestCount} · {tableName(names.tables, row.tableId)}</span>
      <StatusBadge status={row.status} />
    </button>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('reservations');
  const label = isKnownStatus(status) ? t(`statuses.${status}`) : status;
  return <span className={styles.badge} data-status={status}>{label}</span>;
}

function venueName(venues: Venue[], id: string): string {
  return venues.find((venue) => venue.id === id)?.name ?? id.slice(0, 8);
}

function tableName(tables: DiningTable[], id: string | null): string {
  if (id === null) return '—';
  return tables.find((table) => table.id === id)?.name ?? id.slice(0, 8);
}

function hourRange(rows: ReservationSummary[]): number[] {
  const hours = rows.map((row) => hourOf(row.startsAt));
  const start = hours.length === 0 ? 10 : Math.min(...hours);
  const end = hours.length === 0 ? 22 : Math.max(...hours);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function timelineTables(rows: ReservationSummary[], tables: DiningTable[]): DiningTable[] {
  const ids = new Set(rows.map((row) => row.tableId).filter((id): id is string => id !== null));
  const known = tables.filter((table) => ids.has(table.id));
  return known.length > 0 ? known : [...ids].map((id) => ({
    id,
    locationId: '',
    name: id.slice(0, 8),
    minCapacity: 1,
    capacity: 1,
  }));
}

function isKnownStatus(status: string): status is 'PENDING' | 'CONFIRMED' | 'ARRIVED' | 'SEATED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' {
  return ['PENDING', 'CONFIRMED', 'ARRIVED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status);
}
