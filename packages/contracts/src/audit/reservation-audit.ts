import { z } from 'zod';

import {
  auditActions,
  auditActorTypeSchema,
  auditOutcomeSchema,
  auditSchemaVersion,
} from './audit-actions.js';

const tenantRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER']);
const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);

/**
 * A booking was created.
 * `changes` stays null so the row cannot carry a name, phone, email, or note.
 */
export const reservationCreatedAuditSchema = z.strictObject({
  tenantId: z.uuid(),
  actorUserId: z.uuid(),
  actorRole: tenantRoleSchema,
  actorType: auditActorTypeSchema,
  action: z.literal(auditActions.RESERVATION_CREATED),
  resourceType: z.literal('reservation'),
  resourceId: z.uuid(),
  outcome: auditOutcomeSchema,
  changes: z.null(),
  reason: z.string().min(1).max(500).nullable(),
  requestId: z.uuid(),
  ipHash: sha256Hex.nullable(),
  userAgent: z.string().min(1).max(256).nullable(),
  schemaVersion: z.literal(auditSchemaVersion),
});

export type ReservationCreatedAudit = z.infer<typeof reservationCreatedAuditSchema>;
