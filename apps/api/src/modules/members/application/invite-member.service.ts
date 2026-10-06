import { Inject, Injectable } from '@nestjs/common';
import type { Locale } from '@lobby/contracts';
import type { Prisma } from '@lobby/database' with { 'resolution-mode': 'import' };

import { createInvitationSecret, sealInvitationToken } from '../infrastructure/invitation-seal';

import { AuditEventStore } from '../../../common/audit/audit-event.store';
import { OutboxService } from '../../../common/outbox/outbox.service';
import type { RequestContext } from '../../../common/tenant/request-context';
import type { AuditClient } from '../../identity';
import { invitationAuditActions, invitationAuditRecord } from './invitation-audit';
import { invitationCreatedEvent } from './invitation-events';
import { rethrowInvitationConflict } from './invitation-conflict';
import { InvitationError, invitationErrorCodes } from '../domain/invitation.errors';
import { invitationExpiresAt, type InvitableRole } from '../domain/invitation-policy';
import {
  MemberInvitationRepository,
  type InvitationRow,
} from '../infrastructure/member-invitation.repository';

export const INVITATION_TOKEN_KEY = Symbol('INVITATION_TOKEN_KEY');

export type InviteMemberInput = {
  email: string;
  role: InvitableRole;
  locale: Locale;
};

/** Creates one invitation and its outbox event in the same transaction. */
@Injectable()
export class InviteMemberService {
  constructor(
    private readonly invitations: MemberInvitationRepository,
    private readonly outbox: OutboxService,
    private readonly audit: AuditEventStore,
    @Inject(INVITATION_TOKEN_KEY) private readonly tokenKey: Buffer | null,
  ) {}

  async invite(
    context: RequestContext,
    input: InviteMemberInput,
    client: AuditClient,
  ): Promise<{ id: string; expiresAt: Date }> {
    const key = this.requireKey();
    const now = new Date();
    const secret = createInvitationSecret();
    const ciphertext = sealInvitationToken(secret.token, key);
    try {
      return await this.invitations.transaction(async (tx) => {
        await this.assertEmailFree(tx, context.tenantId, input.email, now);
        const expiresAt = invitationExpiresAt(now);
        const stored = await this.storeInvitation(tx, context, input, secret.tokenHash, expiresAt);
        await this.enqueue(tx, context, input, stored.id, ciphertext);
        await this.audit.append(
          tx,
          invitationAuditRecord({
            context,
            invitationId: stored.id,
            action: invitationAuditActions.created,
            client,
          }),
        );
        return { id: stored.id, expiresAt };
      });
    } catch (error) {
      rethrowInvitationConflict(error);
    }
  }

  private requireKey(): Buffer {
    if (this.tokenKey === null) {
      throw new InvitationError(invitationErrorCodes.UNAVAILABLE);
    }
    return this.tokenKey;
  }

  private async assertEmailFree(
    tx: Prisma.TransactionClient,
    tenantId: string,
    email: string,
    now: Date,
  ): Promise<void> {
    if (await this.invitations.userEmailExists(tx, tenantId, email)) {
      throw new InvitationError(invitationErrorCodes.EMAIL_TAKEN);
    }
    const existing = await this.invitations.findUnsettledByEmail(tx, tenantId, email);
    if (existing !== null && existing.expiresAt.getTime() > now.getTime()) {
      throw new InvitationError(invitationErrorCodes.ALREADY_PENDING);
    }
    if (existing !== null) {
      await this.invitations.revoke(tx, existing.id, now);
    }
  }

  private async storeInvitation(
    tx: Prisma.TransactionClient,
    context: RequestContext,
    input: InviteMemberInput,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<InvitationRow> {
    return this.invitations.insert(tx, {
      tenantId: context.tenantId,
      email: input.email,
      role: input.role,
      tokenHash,
      expiresAt,
      invitedById: context.userId,
    });
  }

  private async enqueue(
    tx: Prisma.TransactionClient,
    context: RequestContext,
    input: InviteMemberInput,
    invitationId: string,
    tokenCiphertext: string,
  ): Promise<void> {
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
        recipientEmail: input.email,
        locale: input.locale,
        organizationName: tenant.name,
        inviterName,
        tokenCiphertext,
      }),
    );
  }
}
