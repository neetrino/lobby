import { z } from 'zod';

import { auditActions, auditOutcomeSchema, auditSchemaVersion } from './audit-actions.js';

const tenantRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER']);
const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);
const integrationProviders = ['WEBSITE', 'INSTAGRAM', 'WHATSAPP', 'TELEGRAM'] as const;

const reservationCreatedFields = {
  tenantId: z.uuid(),
  action: z.literal(auditActions.RESERVATION_CREATED),
  resourceType: z.literal('reservation'),
  resourceId: z.uuid(),
  outcome: auditOutcomeSchema,
  reason: z.string().min(1).max(500).nullable(),
  requestId: z.uuid(),
  ipHash: sha256Hex.nullable(),
  userAgent: z.string().min(1).max(256).nullable(),
  schemaVersion: z.literal(auditSchemaVersion),
};

/**
 * A booking was created.
 * Staff rows keep `changes` null. Integration rows store only provider and source account.
 * Neither shape carries a name, phone, email, note, or token.
 */
export const reservationCreatedAuditSchema = z.discriminatedUnion('actorType', [
  z.strictObject({
    ...reservationCreatedFields,
    actorType: z.literal('USER'),
    actorUserId: z.uuid(),
    actorRole: tenantRoleSchema,
    changes: z.null(),
  }),
  z.strictObject({
    ...reservationCreatedFields,
    actorType: z.literal('INTEGRATION'),
    actorUserId: z.null(),
    actorRole: z.null(),
    changes: z.strictObject({
      provider: z.enum(integrationProviders),
      sourceAccountId: z.string().trim().min(1).max(200),
    }),
  }),
]);

export type ReservationCreatedAudit = z.infer<typeof reservationCreatedAuditSchema>;
