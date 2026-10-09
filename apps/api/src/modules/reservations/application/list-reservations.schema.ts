import { pageLimitSchema, reservationStatusSchema, sortDirectionSchema } from '@lobby/contracts';
import { z } from 'zod';

import {
  decodeCursor,
  encodeCursor,
  filterFingerprint,
  filterFingerprintSchema,
} from '../../../common/pagination';

const RESERVATION_CURSOR_MAX_LENGTH = 1024;

const reservationCursorSchema = z.strictObject({
  startsAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
  sort: sortDirectionSchema,
  filterFingerprint: filterFingerprintSchema,
});

export type ReservationCursor = z.infer<typeof reservationCursorSchema>;

const reservationListQueryFields = z.strictObject({
  limit: pageLimitSchema,
  sort: sortDirectionSchema.default('asc'),
  cursor: z
    .string()
    .min(1)
    .max(RESERVATION_CURSOR_MAX_LENGTH)
    .transform((value, context) => {
      const parsed = reservationCursorSchema.safeParse(decodeCursor(value));
      if (!parsed.success) {
        context.addIssue({ code: 'custom', message: 'Invalid cursor' });
        return z.NEVER;
      }
      return parsed.data;
    })
    .optional(),
  locationId: z.uuid().optional(),
  status: reservationStatusSchema.optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});

export const reservationListQuerySchema = reservationListQueryFields.superRefine(
  (query, context) => {
    if (query.from !== undefined && query.to !== undefined && query.from >= query.to) {
      context.addIssue({ code: 'custom', path: ['to'], message: 'Invalid date range' });
    }
    if (query.cursor !== undefined && !reservationCursorMatches(query.cursor, query)) {
      context.addIssue({
        code: 'custom',
        path: ['cursor'],
        message: 'cursor query does not match',
      });
    }
  },
);

export type ReservationListQuery = z.output<typeof reservationListQuerySchema>;

export function encodeReservationCursor(
  position: { startsAt: Date; id: string },
  query: ReservationListQuery,
): string {
  return encodeCursor({
    startsAt: position.startsAt.toISOString(),
    id: position.id,
    sort: query.sort,
    filterFingerprint: reservationFilterFingerprint(query),
  });
}

function reservationCursorMatches(
  cursor: ReservationCursor,
  query: ReservationListQuery,
): boolean {
  return cursor.sort === query.sort && cursor.filterFingerprint === reservationFilterFingerprint(query);
}

function reservationFilterFingerprint(query: ReservationListQuery): string {
  return filterFingerprint({
    locationId: query.locationId ?? null,
    status: query.status ?? null,
    from: query.from ?? null,
    to: query.to ?? null,
  });
}
