import { pageLimitSchema, sortDirectionSchema } from '@lobby/contracts';
import { z } from 'zod';

import {
  decodeCursor,
  encodeCursor,
  filterFingerprint,
  filterFingerprintSchema,
} from '../../../common/pagination';

/** Bound for one contact cursor. It is not a query language. */
const CONTACT_CURSOR_MAX_LENGTH = 1024;

const contactCursorSchema = z.strictObject({
  name: z.string().min(1).max(200),
  id: z.uuid(),
  sort: sortDirectionSchema,
  filterFingerprint: filterFingerprintSchema,
});

export type ContactCursor = z.infer<typeof contactCursorSchema>;

const contactListQueryFields = z.strictObject({
  limit: pageLimitSchema,
  sort: sortDirectionSchema.default('asc'),
  cursor: z
    .string()
    .min(1)
    .max(CONTACT_CURSOR_MAX_LENGTH)
    .transform((value, context) => {
      const parsed = contactCursorSchema.safeParse(decodeCursor(value));
      if (!parsed.success) {
        context.addIssue({ code: 'custom', message: 'Invalid cursor' });
        return z.NEVER;
      }
      return parsed.data;
    })
    .optional(),
  search: z.string().trim().max(100).optional(),
  archived: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  type: z.enum(['person', 'organization']).optional(),
  owner: z.uuid().optional(),
});

/**
 * Query string for one contact page.
 * `sort` is the name direction. `id` is the tie-breaker and is not a client column.
 * Search matches name or phone. Email is not a search field.
 */
export const contactListQuerySchema = contactListQueryFields.superRefine((query, context) => {
  if (query.cursor !== undefined && !contactCursorMatches(query.cursor, query)) {
    context.addIssue({ code: 'custom', path: ['cursor'], message: 'cursor query does not match' });
  }
});

export type ContactListQuery = z.output<typeof contactListQuerySchema>;

/** Opaque contact cursor. The fingerprint covers search, archive, type, and owner, and omits `limit`. */
export function encodeContactCursor(
  position: { name: string; id: string },
  query: ContactListQuery,
): string {
  return encodeCursor({
    name: position.name,
    id: position.id,
    sort: query.sort,
    filterFingerprint: contactFilterFingerprint(query),
  });
}

function contactCursorMatches(cursor: ContactCursor, query: ContactListQuery): boolean {
  return cursor.sort === query.sort && cursor.filterFingerprint === contactFilterFingerprint(query);
}

function contactFilterFingerprint(query: ContactListQuery): string {
  return filterFingerprint({
    search: query.search ?? null,
    archived: query.archived,
    type: query.type ?? null,
    owner: query.owner ?? null,
  });
}
