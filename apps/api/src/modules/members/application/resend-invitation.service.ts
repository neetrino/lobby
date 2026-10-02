import { Inject, Injectable } from '@nestjs/common';
import type { Locale } from '@lobby/contracts';

import { createInvitationSecret, sealInvitationToken } from '../infrastructure/invitation-seal';

import { AuditEventStore } from '../../../common/audit/audit-event.store';
import { OutboxService } from '../../../common/outbox/outbox.service';
import type { RequestContext } from '../../../common/tenant/request-context';
import type { AuditClient } from '../../identity/application/terminate-user-sessions.service';
import { InvitationError, invitationErrorCodes } from '../domain/invitation.errors';
import { invitationExpiresAt } from '../domain/invitation-policy';
import { MemberInvitationRepository } from '../infrastructure/member-invitation.repository';
import { invitationAuditActions, invitationAuditRecord } from './invitation-audit';
import { invitationCreatedEvent } from './invitation-events';
import { rethrowInvitationConflict } from './invitation-conflict';
import { INVITATION_TOKEN_KEY } from './invite-member.service';

/** Replaces the invitation token and queues a new email. The previous token stops working. */
@Injectable()
export class ResendInvitationService {
  constructor(
    private readonly invitations: MemberInvitationRepository,
    private readonly outbox: OutboxService,
    private readonly audit: AuditEventStore,
    @Inject(INVITATION_TOKEN_KEY) private readonly tokenKey: Buffer | null,
  ) {}

  async resend(
    context: RequestContext,
    invitationId: string,
    locale: Locale,
    client: AuditClient,
  ): Promise<{ id: string; expiresAt: Date }> {
    if (this.tokenKey === null) {
      throw new InvitationError(invitationErrorCodes.UNAVAILABLE);
    }
    const key = this.tokenKey;
    const now = new Date();
    const secret = createInvitationSecret();
    const ciphertext = sealInvitationToken(secret.token, key);
    const expiresAt = invitationExpiresAt(now);
    try {
      return await this.invitations.transaction(async (tx) => {
      const current = await this.invitations.findById(tx, invitationId);
      if (current === null || current.tenantId !== context.tenantId || current.acceptedAt !== null || current.revokedAt !== null) {
        throw new InvitationError(invitationErrorCodes.INVALID);
      }
      const replaced = await this.invitations.replaceToken(
        tx,
        invitationId,
        current.tokenHash,
        secret.tokenHash,
        expiresAt,
      );
      if (replaced !== 1) {
        throw new InvitationError(invitationErrorCodes.INVALID);
      }
      const tenant = await this.invitations.tenantIdentity(tx, context.tenantId);
      const inviterName = await this.invitations.inviterName(tx, context.userId, context.tenantId);
      if (tenant === null || inviterName === null) {
        throw new InvitationError(invitationErrorCodes.INVALID);
      }
      await this.outbox.enqueue(
        tx,
        invitationCreatedEvent({
          invitationId,
          tenantId: context.tenantId,
          recipientEmail: current.email,
          locale,
          organizationName: tenant.name,
          inviterName,
          tokenCiphertext: ciphertext,
        }),
      );
      await this.audit.append(
        tx,
        invitationAuditRecord({
          context,
          invitationId,
          action: invitationAuditActions.resent,
          client,
        }),
      );
      return { id: invitationId, expiresAt };
      });
    } catch (error) {
      rethrowInvitationConflict(error);
    }
  }
}
