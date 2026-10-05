import { Inject, Injectable } from '@nestjs/common';

import { InvitationAccessCookie } from '../infrastructure/invitation-access-cookie';
import {
  openInvitationAccess,
  sealInvitationAccess,
  invitationTokenMatches,
  createInvitationSecret,
} from '../infrastructure/invitation-seal';

import { AuditEventStore } from '../../../common/audit/audit-event.store';
import { requestContextFromSession } from '../../../common/tenant/request-context';
import { IdentityError, identityErrorCodes } from '../../identity/domain/identity.errors';
import { PASSWORD_HASHER, type PasswordHasher } from '../../identity/domain/password-hasher';
import type { AuditClient } from '../../identity/application/terminate-user-sessions.service';
import { INCIDENT_LOGGER, type IncidentLogger } from '../../identity/infrastructure/incident-logger';
import { RedisSessionStore, StaleSessionError } from '../../identity/infrastructure/redis-session.store';
import { InvitationError, invitationErrorCodes } from '../domain/invitation.errors';
import { isInvitationOpen } from '../domain/invitation-policy';
import {
  MemberInvitationRepository,
  type InvitationRow,
} from '../infrastructure/member-invitation.repository';
import { invitationAuditActions, invitationAuditRecord } from './invitation-audit';
import { rethrowInvitationConflict } from './invitation-conflict';
import { INVITATION_TOKEN_KEY } from './invite-member.service';

export type AcceptInvitationInput = {
  invitationId: string;
  name: string;
  password: string;
  requestId: string;
};

export type AcceptedInvitation = {
  account: {
    tenant: { id: string; name: string; subdomain: string; plan: 'starter' };
    user: { id: string; name: string; email: string; role: 'MEMBER' };
  };
  rawSessionId: string;
};

export type InvitationPreview = {
  organizationName: string;
  subdomain: string;
  email: string;
  role: 'MEMBER';
};

/** Turns one open invitation into an ACTIVE member and a session. */
@Injectable()
export class AcceptInvitationService {
  constructor(
    private readonly invitations: MemberInvitationRepository,
    private readonly audit: AuditEventStore,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher,
    private readonly sessions: RedisSessionStore,
    @Inject(INCIDENT_LOGGER) private readonly incidents: IncidentLogger,
    private readonly accessCookie: InvitationAccessCookie,
    @Inject(INVITATION_TOKEN_KEY) private readonly tokenKey: Buffer | null,
  ) {}

  /**
   * Replaces the email token before the cookie reaches the browser.
   * A dropped response leaves the email link invalid; an Owner or Admin resend recovers it.
   * The seal lives only in that response, for the invitation's remaining lifetime.
   */
  async exchange(
    invitationId: string,
    token: string,
    now: Date,
  ): Promise<{ sealed: string; maxAgeMs: number }> {
    const key = this.requireKey();
    const invitation = await this.openInvitation(invitationId, token, now);
    const secret = createInvitationSecret();
    try {
      await this.rotateToken(invitation, secret.tokenHash);
    } catch (error) {
      rethrowInvitationConflict(error);
    }
    const maxAgeMs = Math.max(invitation.expiresAt.getTime() - now.getTime(), 1);
    return { sealed: sealInvitationAccess({ invitationId, token: secret.token }, key), maxAgeMs };
  }

  async preview(
    invitationId: string,
    cookieHeader: string | readonly string[] | undefined,
  ): Promise<InvitationPreview> {
    const token = this.cookieToken(invitationId, cookieHeader);
    const invitation = await this.openInvitation(invitationId, token, new Date());
    const tenant = await this.invitations.loadTenant(invitation.tenantId);
    return previewFrom(invitation, tenant);
  }

  async accept(
    input: AcceptInvitationInput,
    cookieHeader: string | readonly string[] | undefined,
    client: AuditClient,
  ): Promise<AcceptedInvitation> {
    const now = new Date();
    const invitation = await this.openInvitation(
      input.invitationId,
      this.cookieToken(input.invitationId, cookieHeader),
      now,
    );
    const passwordHash = await this.passwords.hash(input.password);
    const created = await this.commitMember(invitation, input, passwordHash, client, now).catch(
      rethrowInvitationConflict,
    );
    const rawSessionId = await this.openSession(created);
    return {
      account: { tenant: created.tenant, user: created.user },
      rawSessionId,
    };
  }

  private async rotateToken(invitation: InvitationRow, tokenHash: string): Promise<void> {
    const replaced = await this.invitations.transaction((tx) =>
      this.invitations.replaceToken(
        tx,
        invitation.id,
        invitation.tokenHash,
        tokenHash,
        invitation.expiresAt,
      ),
    );
    if (replaced !== 1) {
      throw new InvitationError(invitationErrorCodes.INVALID);
    }
  }

  private cookieToken(
    invitationId: string,
    cookieHeader: string | readonly string[] | undefined,
  ): string {
    const sealed = this.accessCookie.read(cookieHeader);
    const access = sealed === null ? null : openInvitationAccess(sealed, this.requireKey());
    if (access === null || access.invitationId !== invitationId) {
      throw new InvitationError(invitationErrorCodes.INVALID);
    }
    return access.token;
  }

  private requireKey(): Buffer {
    if (this.tokenKey === null) {
      throw new InvitationError(invitationErrorCodes.UNAVAILABLE);
    }
    return this.tokenKey;
  }

  private async openInvitation(
    invitationId: string,
    token: string,
    now: Date,
  ): Promise<InvitationRow> {
    const invitation = await this.invitations.loadById(invitationId);
    const matches = invitationTokenMatches(token, invitation?.tokenHash ?? null);
    if (invitation === null || !matches || !isInvitationOpen(invitation, now)) {
      throw new InvitationError(invitationErrorCodes.INVALID);
    }
    return invitation;
  }

  private commitMember(
    invitation: InvitationRow,
    input: AcceptInvitationInput,
    passwordHash: string,
    client: AuditClient,
    now: Date,
  ): Promise<AcceptedInvitation['account'] & { authenticationVersion: number }> {
    return this.invitations.transaction(async (tx) => {
      if (await this.invitations.userEmailExists(tx, invitation.tenantId, invitation.email)) {
        throw new InvitationError(invitationErrorCodes.EMAIL_TAKEN);
      }
      const tenant = await this.invitations.tenantIdentity(tx, invitation.tenantId);
      if (tenant === null) {
        throw new InvitationError(invitationErrorCodes.INVALID);
      }
      const user = await this.invitations.createMember(tx, {
        tenantId: invitation.tenantId,
        email: invitation.email,
        name: input.name,
        passwordHash,
      });
      const accepted = await this.invitations.markAccepted(
        tx,
        invitation.id,
        now,
        invitation.tokenHash,
      );
      if (accepted !== 1) {
        throw new InvitationError(invitationErrorCodes.INVALID);
      }
      const context = requestContextFromSession(
        { tenantId: invitation.tenantId, userId: user.id, role: 'MEMBER' },
        input.requestId,
      );
      await this.audit.append(
        tx,
        invitationAuditRecord({
          context,
          invitationId: invitation.id,
          action: invitationAuditActions.accepted,
          client,
          actorUserId: user.id,
          actorRole: 'MEMBER',
        }),
      );
      return {
        authenticationVersion: user.authenticationVersion,
        tenant: { id: invitation.tenantId, name: tenant.name, subdomain: tenant.subdomain, plan: 'starter' },
        user: { id: user.id, name: input.name, email: invitation.email, role: 'MEMBER' as const },
      };
    });
  }

  private async openSession(
    created: AcceptedInvitation['account'] & { authenticationVersion: number },
  ): Promise<string> {
    try {
      const opened = await this.sessions.create(
        {
          userId: created.user.id,
          tenantId: created.tenant.id,
          role: 'MEMBER',
          authenticationVersion: created.authenticationVersion,
        },
        new Date(),
      );
      return opened.rawSessionId;
    } catch (error) {
      if (!(error instanceof StaleSessionError)) {
        this.incidents.error(
          `Invitation acceptance committed but the session was not created. tenantId=${created.tenant.id} userId=${created.user.id}`,
        );
      }
      throw new IdentityError(identityErrorCodes.ACCOUNT_CREATED_SIGN_IN_REQUIRED);
    }
  }
}

function previewFrom(
  invitation: InvitationRow,
  tenant: { name: string; subdomain: string } | null,
): InvitationPreview {
  if (tenant === null) {
    throw new InvitationError(invitationErrorCodes.INVALID);
  }
  return {
    organizationName: tenant.name,
    subdomain: tenant.subdomain,
    email: invitation.email,
    role: invitation.role,
  };
}
