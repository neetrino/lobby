const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC calendar date `YYYY-MM-DD`. */
export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Inclusive UTC days from `from` through the UTC day of `to`. */
export function utcDayKeys(from: Date, to: Date): string[] {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  const keys: string[] = [];
  for (let cursor = start; cursor <= end; cursor += DAY_MS) {
    keys.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return keys;
}

export function inHalfOpen(date: Date, from: Date, to: Date): boolean {
  const time = date.getTime();
  return time >= from.getTime() && time < to.getTime();
}
