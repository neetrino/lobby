import { auditActions, type InvitationAudit } from '@lobby/contracts';

import type { AuditClient } from '../../identity/application/terminate-user-sessions.service';
import type { RequestContext } from '../../../common/tenant/request-context';

type InvitationAuditAction = InvitationAudit['action'];

export function invitationAuditRecord(input: {
  context: RequestContext;
  invitationId: string;
  action: InvitationAuditAction;
  client: AuditClient;
  actorUserId?: string;
  actorRole?: RequestContext['role'];
}): Omit<InvitationAudit, 'schemaVersion'> {
  return {
    tenantId: input.context.tenantId,
    actorUserId: input.actorUserId ?? input.context.userId,
    actorRole: input.actorRole ?? input.context.role,
    actorType: 'USER',
    action: input.action,
    resourceType: 'memberInvitation',
    resourceId: input.invitationId,
    outcome: 'SUCCESS',
    changes: null,
    reason: null,
    requestId: input.context.requestId,
    ipHash: input.client.ipHash,
    userAgent: input.client.userAgent,
  };
}

export const invitationAuditActions = {
  created: auditActions.INVITATION_CREATED,
  resent: auditActions.INVITATION_RESENT,
  revoked: auditActions.INVITATION_REVOKED,
  accepted: auditActions.INVITATION_ACCEPTED,
} as const;
