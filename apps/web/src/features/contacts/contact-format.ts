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

export function shortId(id: string): string {
  return id.slice(0, 8);
}

/** Calendar date and UTC clock, matching the contacts list stamp. */
export function formatContactStamp(iso: string, locale: string): { date: string; time: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { date: iso, time: '' };
  }
  const dateText = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
  const timeText = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).format(date);
  return { date: dateText, time: `${timeText} UTC` };
}
