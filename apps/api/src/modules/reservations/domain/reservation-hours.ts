const MINUTES_PER_DAY = 24 * 60;
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as const;

export type LocalMoment = { date: string; minutes: number; weekday: number };
export type OpenWindow = { opensMinute: number; closesMinute: number };

/** Wall-clock minutes of a PostgreSQL `time` value stored as UTC. */
export function clockMinutes(value: Date): number {
  return value.getUTCHours() * 60 + value.getUTCMinutes();
}

/** Local calendar parts in an IANA timezone. Weekday 0 is Sunday. */
export function localMoment(instant: Date, timeZone: string): LocalMoment {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const weekday = WEEKDAYS[read('weekday') as keyof typeof WEEKDAYS];
  if (weekday === undefined) {
    throw new RangeError('Invalid timezone');
  }
  return {
    date: `${read('year')}-${read('month')}-${read('day')}`,
    minutes: Number(read('hour')) * 60 + Number(read('minute')),
    weekday,
  };
}

/** The calendar date before `date` (`YYYY-MM-DD`). */
export function previousLocalDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const utc = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return utc.toISOString().slice(0, 10);
}

/**
 * True when the visit sits inside one open window.
 * A close earlier than the open continues past local midnight (`18:00–02:00`).
 */
export function fitsOpenWindow(
  startsAt: Date,
  endsAt: Date,
  timeZone: string,
  openDate: string,
  window: OpenWindow,
): boolean {
  const startMinute = offsetMinutes(openDate, localMoment(startsAt, timeZone));
  const endMinute = offsetMinutes(openDate, localMoment(endsAt, timeZone));
  const closeMinute =
    window.closesMinute > window.opensMinute
      ? window.closesMinute
      : window.closesMinute + MINUTES_PER_DAY;
  return startMinute >= window.opensMinute && endMinute <= closeMinute;
}

function offsetMinutes(openDate: string, moment: LocalMoment): number {
  const [year, month, day] = openDate.split('-').map(Number);
  const [localYear, localMonth, localDay] = moment.date.split('-').map(Number);
  const days = Math.round(
    (Date.UTC(localYear ?? 0, (localMonth ?? 1) - 1, localDay ?? 1) -
      Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)) /
      86_400_000,
  );
  return days * MINUTES_PER_DAY + moment.minutes;
}
