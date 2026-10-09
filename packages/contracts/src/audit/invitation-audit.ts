import { z } from 'zod';

import { auditActions, auditOutcomeSchema, auditSchemaVersion } from './audit-actions.js';

const tenantRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER']);
const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);

/**
 * Invitation lifecycle.
 * `changes` stays null so the row cannot carry an email, token, or password.
 */
export const invitationAuditSchema = z.strictObject({
  tenantId: z.uuid(),
  actorUserId: z.uuid(),
  actorRole: tenantRoleSchema,
  actorType: z.literal('USER'),
  action: z.enum([
    auditActions.INVITATION_CREATED,
    auditActions.INVITATION_RESENT,
    auditActions.INVITATION_REVOKED,
    auditActions.INVITATION_ACCEPTED,
  ]),
  resourceType: z.literal('memberInvitation'),
  resourceId: z.uuid(),
  outcome: auditOutcomeSchema,
  changes: z.null(),
  reason: z.string().min(1).max(500).nullable(),
  requestId: z.uuid(),
  ipHash: sha256Hex.nullable(),
  userAgent: z.string().min(1).max(256).nullable(),
  schemaVersion: z.literal(auditSchemaVersion),
});

export type InvitationAudit = z.infer<typeof invitationAuditSchema>;
