import { Injectable } from '@nestjs/common';

import { AuditEventStore } from '../../../common/audit/audit-event.store';
import type { RequestContext } from '../../../common/tenant/request-context';
import type { AuditClient } from '../../identity/application/terminate-user-sessions.service';
import { InvitationError, invitationErrorCodes } from '../domain/invitation.errors';
import { MemberInvitationRepository } from '../infrastructure/member-invitation.repository';
import { invitationAuditActions, invitationAuditRecord } from './invitation-audit';

/** Closes an invitation so its token can no longer be accepted. */
@Injectable()
export class RevokeInvitationService {
  constructor(
    private readonly invitations: MemberInvitationRepository,
    private readonly audit: AuditEventStore,
  ) {}

  async revoke(context: RequestContext, invitationId: string, client: AuditClient): Promise<void> {
    const now = new Date();
    await this.invitations.transaction(async (tx) => {
      const current = await this.invitations.findById(tx, invitationId);
      if (
        current === null ||
        current.tenantId !== context.tenantId ||
        current.acceptedAt !== null ||
        current.revokedAt !== null
      ) {
        throw new InvitationError(invitationErrorCodes.INVALID);
      }
      const revoked = await this.invitations.revoke(tx, invitationId, now);
      if (revoked !== 1) {
        throw new InvitationError(invitationErrorCodes.INVALID);
      }
      await this.audit.append(
        tx,
        invitationAuditRecord({
          context,
          invitationId,
          action: invitationAuditActions.revoked,
          client,
        }),
      );
    });
  }
}
