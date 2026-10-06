import { inHalfOpen, utcDayKey, utcDayKeys } from '../../../common/dates/utc-day';

const SAME_WRITE_MS = 1000;

export type ContactActivityDay = {
  date: string;
  created: number;
  updated: number;
  archived: number;
};

export type ContactActivityStamp = {
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

/** One current row can add a create, an update, and an archive on their own UTC days. */
export function contactActivityDays(
  from: Date,
  to: Date,
  rows: ContactActivityStamp[],
): ContactActivityDay[] {
  const days = emptyDays(from, to);
  for (const row of rows) {
    add(days, row.createdAt, from, to, 'created');
    addArchiveOrUpdate(days, row, from, to);
  }
  return [...days.values()];
}

function emptyDays(from: Date, to: Date): Map<string, ContactActivityDay> {
  return new Map(
    utcDayKeys(from, to).map((date) => [date, { date, created: 0, updated: 0, archived: 0 }]),
  );
}

function addArchiveOrUpdate(
  days: Map<string, ContactActivityDay>,
  row: ContactActivityStamp,
  from: Date,
  to: Date,
): void {
  if (row.archivedAt !== null && inHalfOpen(row.archivedAt, from, to)) {
    add(days, row.archivedAt, from, to, 'archived');
    return;
  }
  if (row.updatedAt.getTime() - row.createdAt.getTime() < SAME_WRITE_MS) {
    return;
  }
  add(days, row.updatedAt, from, to, 'updated');
}

function add(
  days: Map<string, ContactActivityDay>,
  stamp: Date,
  from: Date,
  to: Date,
  key: 'created' | 'updated' | 'archived',
): void {
  if (!inHalfOpen(stamp, from, to)) {
    return;
  }
  const day = days.get(utcDayKey(stamp));
  if (day !== undefined) {
    day[key] += 1;
  }
}
