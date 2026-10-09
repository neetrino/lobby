export function formatContactDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date);
}

/** `dd.mm.yyyy HH:mm` in UTC, shown under an archived contact name. */
export function formatArchivedMark(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const pad = (value: number): string => String(value).padStart(2, '0');
  const day = pad(date.getUTCDate());
  const month = pad(date.getUTCMonth() + 1);
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  return `${day}.${month}.${date.getUTCFullYear()} ${hours}:${minutes}`;
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}

/** Calendar date and hours:minutes for the contacts list. */
export function formatContactStamp(iso: string, locale: string): { date: string; time: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { date: iso, time: '' };
  }
  const dateText = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
  const timeText = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).format(date);
  return { date: dateText, time: timeText };
}
