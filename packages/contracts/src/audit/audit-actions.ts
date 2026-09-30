import { z } from 'zod';

/**
 * Closed audit catalog. Format is `resource.verb` in the past tense.
 * A new action is added here before any writer uses it.
 */
export const auditActions = {
  USER_SESSIONS_TERMINATED: 'user.sessions.terminated',
  USER_ROLE_CHANGED: 'user.role.changed',
  USER_DISABLED: 'user.disabled',
  CONTACT_DELETED: 'contact.deleted',
  DEAL_STAGE_CHANGED: 'deal.stage.changed',
  RESERVATION_STATUS_CHANGED: 'reservation.status.changed',
} as const;

export const auditActionValues = [
  auditActions.USER_SESSIONS_TERMINATED,
  auditActions.USER_ROLE_CHANGED,
  auditActions.USER_DISABLED,
  auditActions.CONTACT_DELETED,
  auditActions.DEAL_STAGE_CHANGED,
  auditActions.RESERVATION_STATUS_CHANGED,
] as const;

export const auditActionSchema = z.enum(auditActionValues);

export type AuditAction = z.infer<typeof auditActionSchema>;

export const auditOutcomes = ['SUCCESS', 'DENIED', 'FAILURE'] as const;
export const auditOutcomeSchema = z.enum(auditOutcomes);
export type AuditOutcome = z.infer<typeof auditOutcomeSchema>;

export const auditActorTypes = ['USER'] as const;
export const auditActorTypeSchema = z.enum(auditActorTypes);
export type AuditActorType = z.infer<typeof auditActorTypeSchema>;

export const auditResourceTypes = ['user', 'contact', 'deal', 'reservation'] as const;
export const auditResourceTypeSchema = z.enum(auditResourceTypes);
export type AuditResourceType = z.infer<typeof auditResourceTypeSchema>;

export const auditSchemaVersion = 1 as const;
