import { z } from 'zod';

import { auditActions, auditOutcomeSchema, auditSchemaVersion } from './audit-actions.js';

const tenantRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER']);

const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);

export const authenticationVersionChangeSchema = z.strictObject({
  authenticationVersion: z.strictObject({
    from: z.number().int().min(1),
    to: z.number().int().min(1),
  }),
});

export type AuthenticationVersionChange = z.infer<typeof authenticationVersionChangeSchema>;

/**
 * `user.sessions.terminated` write.
 * SUCCESS carries only the version change. DENIED and FAILURE carry no before/after values.
 */
export const userSessionsTerminatedAuditSchema = z
  .strictObject({
    tenantId: z.uuid(),
    actorUserId: z.uuid(),
    actorRole: tenantRoleSchema,
    actorType: z.literal('USER'),
    action: z.literal(auditActions.USER_SESSIONS_TERMINATED),
    resourceType: z.literal('user'),
    resourceId: z.uuid(),
    outcome: auditOutcomeSchema,
    changes: authenticationVersionChangeSchema.nullable(),
    reason: z.string().min(1).max(500).nullable(),
    requestId: z.uuid(),
    ipHash: sha256Hex.nullable(),
    userAgent: z.string().min(1).max(256).nullable(),
    schemaVersion: z.literal(auditSchemaVersion),
  })
  .superRefine((record, context) => {
    if (record.outcome === 'SUCCESS' && record.changes === null) {
      context.addIssue({ code: 'custom', path: ['changes'], message: 'SUCCESS requires changes' });
    }
    if (record.outcome !== 'SUCCESS' && record.changes !== null) {
      context.addIssue({
        code: 'custom',
        path: ['changes'],
        message: 'Only SUCCESS records changes',
      });
    }
  });

export type UserSessionsTerminatedAudit = z.infer<typeof userSessionsTerminatedAuditSchema>;
