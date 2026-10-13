import type { DashboardRangeDays } from '@lobby/contracts';

const DAY_MS = 24 * 60 * 60 * 1000;

export type DashboardWindow = {
  from: Date;
  to: Date;
  previousFrom: Date;
  todayStart: Date;
  todayEnd: Date;
  yesterdayStart: Date;
  now: Date;
};

/** UTC day bounds. Venue-local days stay out until a single venue timezone is selected. */
export function dateWindow(rangeDays: DashboardRangeDays, now: Date): DashboardWindow {
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(now.getTime() - rangeDays * DAY_MS);
  return {
    from,
    to: now,
    previousFrom: new Date(from.getTime() - rangeDays * DAY_MS),
    todayStart,
    todayEnd: new Date(todayStart.getTime() + DAY_MS),
    yesterdayStart: new Date(todayStart.getTime() - DAY_MS),
    now,
  };
}
