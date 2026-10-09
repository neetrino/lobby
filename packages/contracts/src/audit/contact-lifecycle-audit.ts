import { z } from 'zod';

import { auditActions, auditOutcomeSchema, auditSchemaVersion } from './audit-actions.js';

const tenantRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER']);
const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);

/**
 * Soft archive and restore.
 * `changes` stays null so the row cannot carry a name, email, or phone.
 */
export const contactLifecycleAuditSchema = z.strictObject({
  tenantId: z.uuid(),
  actorUserId: z.uuid(),
  actorRole: tenantRoleSchema,
  actorType: z.literal('USER'),
  action: z.enum([auditActions.CONTACT_ARCHIVED, auditActions.CONTACT_RESTORED]),
  resourceType: z.literal('contact'),
  resourceId: z.uuid(),
  outcome: auditOutcomeSchema,
  changes: z.null(),
  reason: z.string().min(1).max(500).nullable(),
  requestId: z.uuid(),
  ipHash: sha256Hex.nullable(),
  userAgent: z.string().min(1).max(256).nullable(),
  schemaVersion: z.literal(auditSchemaVersion),
});

export type ContactLifecycleAudit = z.infer<typeof contactLifecycleAuditSchema>;
