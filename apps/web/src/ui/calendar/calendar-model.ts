export type CalendarMode = 'date' | 'datetime';

export type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export type DayCell = {
  key: string;
  day: number;
  inMonth: boolean;
  value: string;
};

const datePattern = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

export function parseDateTime(value: string): DateParts | null {
  const match = datePattern.exec(value);
  if (match === null) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4] ?? 0);
  const minute = Number(match[5] ?? 0);
  const date = new Date(year, month, day, hour, minute);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  if (hour > 23 || minute > 59) {
    return null;
  }
  return { year, month, day, hour, minute };
}

export function todayParts(now = new Date()): DateParts {
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
  };
}

export function dateValue(parts: Pick<DateParts, 'year' | 'month' | 'day'>): string {
  return `${parts.year}-${pad(parts.month + 1)}-${pad(parts.day)}`;
}

export function dateTimeValue(parts: DateParts): string {
  return `${dateValue(parts)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function withTime(day: string, hour: number, minute: number): string {
  return `${day}T${pad(clamp(hour, 23))}:${pad(clamp(minute, 59))}`;
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** Sunday for English, Monday for the other CRM locales. */
export function weekStartsOn(locale: string): 0 | 1 {
  return locale.toLowerCase().startsWith('en') ? 0 : 1;
}

export function buildMonth(year: number, month: number, start: 0 | 1): DayCell[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() - start + 7) % 7;
  const cursor = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(cursor);
    date.setDate(cursor.getDate() + index);
    const value = dateValue({
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate(),
    });
    return { key: value, day: date.getDate(), inMonth: date.getMonth() === month, value };
  });
}

export function weekdayLabels(locale: string, start: 0 | 1): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  const sunday = new Date(2024, 0, 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + start + index);
    return formatter.format(date);
  });
}

export function monthTitle(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(year, month, 1),
  );
}

export function formatDisplay(value: string, locale: string, mode: CalendarMode): string {
  const parsed = parseDateTime(value);
  if (parsed === null) {
    return '';
  }
  const date = new Date(parsed.year, parsed.month, parsed.day, parsed.hour, parsed.minute);
  const options: Intl.DateTimeFormatOptions =
    mode === 'datetime'
      ? {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }
      : { day: 'numeric', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function readUnit(value: string, max: number): number {
  return clamp(Number(value), max);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function clamp(value: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(max, Math.max(0, Math.trunc(value)));
}
