import { z } from 'zod';

import {
  auditActions,
  auditActorTypeSchema,
  auditSchemaVersion,
} from './audit-actions.js';
import { authenticationVersionChangeSchema } from './audit-record.js';

const tenantRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER']);
const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);

/**
 * Successful password reset.
 * `changes` records only the authentication version. No password, hash, or token.
 */
export const passwordResetAuditSchema = z.strictObject({
  tenantId: z.uuid(),
  actorUserId: z.uuid(),
  actorRole: tenantRoleSchema,
  actorType: auditActorTypeSchema,
  action: z.literal(auditActions.USER_PASSWORD_RESET),
  resourceType: z.literal('user'),
  resourceId: z.uuid(),
  outcome: z.literal('SUCCESS'),
  changes: authenticationVersionChangeSchema,
  reason: z.null(),
  requestId: z.uuid(),
  ipHash: sha256Hex.nullable(),
  userAgent: z.string().min(1).max(256).nullable(),
  schemaVersion: z.literal(auditSchemaVersion),
});

export type PasswordResetAudit = z.infer<typeof passwordResetAuditSchema>;
