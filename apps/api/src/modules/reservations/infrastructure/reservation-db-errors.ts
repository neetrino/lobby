const OVERLAP = 'reservations_no_table_overlap';
const SOURCE_REQUEST = 'reservation_source_requests';

/** True when PostgreSQL rejects an overlapping active booking for one table. */
export function isReservationOverlap(error: unknown): boolean {
  const text = describe(error);
  return text.includes(OVERLAP) || text.includes('23P01');
}

/** True when the source idempotency unique key already exists. */
export function isSourceRequestConflict(error: unknown): boolean {
  const text = describe(error);
  return text.includes(SOURCE_REQUEST) && (text.includes('P2002') || text.includes('23505'));
}

function describe(error: unknown): string {
  const parts: string[] = [];
  collect(error, parts, 0);
  return parts.join(' ');
}

function collect(value: unknown, parts: string[], depth: number): void {
  if (depth > 6 || value === null || value === undefined) {
    return;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    parts.push(String(value));
    return;
  }
  if (typeof value !== 'object') {
    return;
  }
  for (const nested of Object.values(value)) {
    collect(nested, parts, depth + 1);
  }
}
