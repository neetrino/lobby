import { z } from 'zod';

/**
 * Closed audit catalog. Format is `resource.verb` in the past tense.
 * A new action is added here before any writer uses it.
 */
export const auditActions = {
  USER_SESSIONS_TERMINATED: 'user.sessions.terminated',
  INVITATION_CREATED: 'invitation.created',
  INVITATION_RESENT: 'invitation.resent',
  INVITATION_REVOKED: 'invitation.revoked',
  INVITATION_ACCEPTED: 'invitation.accepted',
  USER_ROLE_CHANGED: 'user.role.changed',
  USER_DISABLED: 'user.disabled',
  USER_PASSWORD_RESET: 'user.password.reset',
  CONTACT_DELETED: 'contact.deleted',
  CONTACT_ARCHIVED: 'contact.archived',
  CONTACT_RESTORED: 'contact.restored',
  DEAL_STAGE_CHANGED: 'deal.stage.changed',
  LEAD_STAGE_CHANGED: 'lead.stage.changed',
  LEAD_CONVERTED: 'lead.converted',
  PIPELINE_CONFIGURED: 'pipeline.configured',
  PIPELINE_CARD_DELETED: 'pipeline.card.deleted',
  RESERVATION_STATUS_CHANGED: 'reservation.status.changed',
} as const;

export const auditActionValues = [
  auditActions.USER_SESSIONS_TERMINATED,
  auditActions.INVITATION_CREATED,
  auditActions.INVITATION_RESENT,
  auditActions.INVITATION_REVOKED,
  auditActions.INVITATION_ACCEPTED,
  auditActions.USER_ROLE_CHANGED,
  auditActions.USER_DISABLED,
  auditActions.USER_PASSWORD_RESET,
  auditActions.CONTACT_DELETED,
  auditActions.CONTACT_ARCHIVED,
  auditActions.CONTACT_RESTORED,
  auditActions.DEAL_STAGE_CHANGED,
  auditActions.LEAD_STAGE_CHANGED,
  auditActions.LEAD_CONVERTED,
  auditActions.PIPELINE_CONFIGURED,
  auditActions.PIPELINE_CARD_DELETED,
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

export const auditResourceTypes = [
  'user',
  'memberInvitation',
  'contact',
  'deal',
  'lead',
  'pipeline',
  'reservation',
] as const;
export const auditResourceTypeSchema = z.enum(auditResourceTypes);
export type AuditResourceType = z.infer<typeof auditResourceTypeSchema>;

export const auditSchemaVersion = 1 as const;
