import {
  auditActionSchema,
  auditOutcomeSchema,
  auditResourceTypeSchema,
  pageLimitSchema,
  sortDirectionSchema,
} from '@lobby/contracts';
import { z } from 'zod';

import { decodeCursor, encodeCursor, filterFingerprint, filterFingerprintSchema } from '../pagination';

/** Bound for one audit cursor. It is not a query language. */
const AUDIT_EVENT_CURSOR_MAX_LENGTH = 1024;

const auditEventCursorSchema = z.strictObject({
  occurredAt: z.iso.datetime(),
  id: z.uuid(),
  sort: sortDirectionSchema,
  filterFingerprint: filterFingerprintSchema,
});

export type AuditEventCursor = z.infer<typeof auditEventCursorSchema>;

const auditEventListQueryFields = z.strictObject({
  limit: pageLimitSchema,
  sort: sortDirectionSchema.default('desc'),
  cursor: z
    .string()
    .min(1)
    .max(AUDIT_EVENT_CURSOR_MAX_LENGTH)
    .transform((value, context) => {
      const parsed = auditEventCursorSchema.safeParse(decodeCursor(value));
      if (!parsed.success) {
        context.addIssue({ code: 'custom', message: 'Invalid cursor' });
        return z.NEVER;
      }
      return parsed.data;
    })
    .optional(),
  action: auditActionSchema.optional(),
  outcome: auditOutcomeSchema.optional(),
  actorUserId: z.uuid().optional(),
  resourceType: auditResourceTypeSchema.optional(),
  resourceId: z.uuid().optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

/**
 * Query string for one audit history page.
 * Unknown keys are rejected. `sort` is only the `occurredAt` direction.
 */
export const auditEventListQuerySchema = auditEventListQueryFields.superRefine((query, context) => {
  if (query.from !== undefined && query.to !== undefined && Date.parse(query.from) > Date.parse(query.to)) {
    context.addIssue({ code: 'custom', path: ['from'], message: 'from is after to' });
  }
  if (query.cursor !== undefined && !auditCursorMatches(query.cursor, query)) {
    context.addIssue({ code: 'custom', path: ['cursor'], message: 'cursor query does not match' });
  }
});

export type AuditEventListQuery = z.output<typeof auditEventListQuerySchema>;

/** Opaque audit cursor. The fingerprint covers this endpoint's filters and omits `limit`. */
export function encodeAuditEventCursor(
  position: { occurredAt: string; id: string },
  query: AuditEventListQuery,
): string {
  return encodeCursor({
    occurredAt: position.occurredAt,
    id: position.id,
    sort: query.sort,
    filterFingerprint: auditFilterFingerprint(query),
  });
}

function auditCursorMatches(cursor: AuditEventCursor, query: AuditEventListQuery): boolean {
  return cursor.sort === query.sort && cursor.filterFingerprint === auditFilterFingerprint(query);
}

function auditFilterFingerprint(query: AuditEventListQuery): string {
  return filterFingerprint({
    action: query.action ?? null,
    outcome: query.outcome ?? null,
    actorUserId: query.actorUserId ?? null,
    resourceType: query.resourceType ?? null,
    resourceId: query.resourceId ?? null,
    from: query.from ?? null,
    to: query.to ?? null,
  });
}
