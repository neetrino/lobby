import { z } from 'zod';

import {
  auditActions,
  auditActorTypeSchema,
  auditOutcomeSchema,
  auditSchemaVersion,
} from './audit-actions.js';

const tenantRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER']);
const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);

/** Board configuration, card deletion, stage change, and lead conversion. `changes` carries no card text. */
export const pipelineAuditSchema = z.strictObject({
  tenantId: z.uuid(),
  actorUserId: z.uuid(),
  actorRole: tenantRoleSchema,
  actorType: auditActorTypeSchema,
  action: z.enum([
    auditActions.PIPELINE_CONFIGURED,
    auditActions.PIPELINE_CARD_DELETED,
    auditActions.PIPELINE_CARD_UPDATED,
    auditActions.DEAL_STAGE_CHANGED,
    auditActions.LEAD_STAGE_CHANGED,
    auditActions.LEAD_CONVERTED,
  ]),
  resourceType: z.enum(['pipeline', 'deal', 'lead']),
  resourceId: z.uuid(),
  outcome: auditOutcomeSchema,
  changes: z.null(),
  reason: z.string().min(1).max(500).nullable(),
  requestId: z.uuid(),
  ipHash: sha256Hex.nullable(),
  userAgent: z.string().min(1).max(256).nullable(),
  schemaVersion: z.literal(auditSchemaVersion),
});

export type PipelineAudit = z.infer<typeof pipelineAuditSchema>;
