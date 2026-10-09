import type { CursorPage } from '@lobby/contracts';
import type { Prisma } from '@lobby/database' with { 'resolution-mode': 'import' };

import type { ReservationRecord } from '../infrastructure/reservation.repository';
import {
  encodeReservationCursor,
  type ReservationListQuery,
} from './list-reservations.schema';

export function reservationListFilter(
  query: ReservationListQuery,
): Prisma.ReservationWhereInput {
  const filters: Prisma.ReservationWhereInput[] = [];
  if (query.locationId !== undefined) filters.push({ locationId: query.locationId });
  if (query.status !== undefined) filters.push({ status: query.status });
  if (query.from !== undefined) filters.push({ startsAt: { gte: new Date(query.from) } });
  if (query.to !== undefined) filters.push({ startsAt: { lt: new Date(query.to) } });
  if (query.cursor !== undefined) {
    filters.push(cursorFilter(new Date(query.cursor.startsAt), query.cursor.id, query.sort));
  }
  return filters.length === 0 ? {} : { AND: filters };
}

export function reservationListOrder(
  sort: ReservationListQuery['sort'],
): Prisma.ReservationOrderByWithRelationInput[] {
  return [{ startsAt: sort }, { id: sort }];
}

export function toReservationPage(
  rows: readonly ReservationRecord[],
  query: ReservationListQuery,
): CursorPage<ReservationRecord> {
  const visible = rows.slice(0, query.limit);
  const last = visible.at(-1);
  return {
    data: [...visible],
    page: {
      nextCursor:
        rows.length > query.limit && last !== undefined
          ? encodeReservationCursor(last, query)
          : null,
    },
  };
}

function cursorFilter(
  startsAt: Date,
  id: string,
  sort: ReservationListQuery['sort'],
): Prisma.ReservationWhereInput {
  if (sort === 'asc') {
    return { OR: [{ startsAt: { gt: startsAt } }, { AND: [{ startsAt }, { id: { gt: id } }] }] };
  }
  return { OR: [{ startsAt: { lt: startsAt } }, { AND: [{ startsAt }, { id: { lt: id } }] }] };
}
