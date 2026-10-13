const DAY_MS = 24 * 60 * 60 * 1000;

export type HourGuests = { hour: number; guests: number };

export type ReservationLoad = {
  capacity: number | null;
  today: HourGuests[];
  tomorrow: HourGuests[];
  week: HourGuests[];
};

export type ReservationLoadRow = { startsAt: Date; partySize: number };

/**
 * Guest counts by UTC hour. An empty day is an empty list, not a row of invented zeros.
 * The week list sums the next seven UTC days onto the hour of day.
 */
export function reservationLoad(
  todayStart: Date,
  rows: ReservationLoadRow[],
  capacity: number | null,
): ReservationLoad {
  const tomorrow = new Date(todayStart.getTime() + DAY_MS);
  const weekEnd = new Date(todayStart.getTime() + 7 * DAY_MS);
  return {
    capacity,
    today: hoursBetween(rows, todayStart, tomorrow),
    tomorrow: hoursBetween(rows, tomorrow, new Date(tomorrow.getTime() + DAY_MS)),
    week: hoursBetween(rows, todayStart, weekEnd),
  };
}

function hoursBetween(rows: ReservationLoadRow[], from: Date, to: Date): HourGuests[] {
  const counts = new Map<number, number>();
  for (const row of rows) {
    if (row.startsAt.getTime() < from.getTime() || row.startsAt.getTime() >= to.getTime()) {
      continue;
    }
    const hour = row.startsAt.getUTCHours();
    counts.set(hour, (counts.get(hour) ?? 0) + row.partySize);
  }
  return fillHours(counts);
}

function fillHours(counts: Map<number, number>): HourGuests[] {
  const hours = [...counts.keys()];
  const first = hours[0];
  if (first === undefined) {
    return [];
  }
  const min = Math.min(...hours);
  const max = Math.max(...hours);
  const filled: HourGuests[] = [];
  for (let hour = min; hour <= max; hour += 1) {
    filled.push({ hour, guests: counts.get(hour) ?? 0 });
  }
  return filled;
}
