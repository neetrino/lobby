import { Controller, Get, HttpCode, Inject, Post, Req } from '@nestjs/common';

import { CurrentRequest } from '../../../common/auth/current-request';
import { Authorize } from '../../../common/authorization/permission.guard';
import { ZodBody, ZodParam } from '../../../common/pipes/zod-input';
import type { RequestContext } from '../../../common/tenant/request-context';
import { AuthRateLimitService } from '../../identity';
import { readClientAddress } from '../../../common/security/client-address';
import { InviteMemberService } from '../application/invite-member.service';
import { ListTeamService } from '../application/list-team.service';
import { ResendInvitationService } from '../application/resend-invitation.service';
import { RevokeInvitationService } from '../application/revoke-invitation.service';
import {
  invitationIdSchema,
  inviteMemberSchema,
  resendInvitationSchema,
  type InviteMemberBody,
  type ResendInvitationBody,
} from './dto/invitation.schema';
import {
  AUDIT_IP_HASH_KEY,
  invitationAuditClient,
  type InvitationHttpRequest,
} from './invitation-request';

@Controller('members')
export class MemberInvitationsController {
  constructor(
    private readonly team: ListTeamService,
    private readonly inviteMember: InviteMemberService,
    private readonly resendInvitation: ResendInvitationService,
    private readonly revokeInvitation: RevokeInvitationService,
    private readonly rates: AuthRateLimitService,
    @Inject(AUDIT_IP_HASH_KEY) private readonly auditIpHashKey: string | null,
  ) {}

  @Get('invitations')
  @Authorize('members:invite')
  async list(@CurrentRequest() context: RequestContext) {
    const snapshot = await this.team.list(context);
    return { data: snapshot };
  }

  @Post('invitations')
  @Authorize('members:invite')
  @HttpCode(201)
  async invite(
    @CurrentRequest() context: RequestContext,
    @ZodBody(inviteMemberSchema) body: InviteMemberBody,
    @Req() request: InvitationHttpRequest,
  ) {
    await this.rates.consumeInvite(readClientAddress(request), context.tenantId, context.userId);
    const created = await this.inviteMember.invite(
      context,
      { email: body.email, role: body.role, locale: body.locale ?? 'en' },
      invitationAuditClient(request, this.auditIpHashKey),
    );
    return { data: created };
  }

  @Post('invitations/:invitationId/resend')
  @Authorize('members:invite')
  @HttpCode(200)
  async resend(
    @CurrentRequest() context: RequestContext,
    @ZodParam('invitationId', invitationIdSchema) invitationId: string,
    @ZodBody(resendInvitationSchema) body: ResendInvitationBody,
    @Req() request: InvitationHttpRequest,
  ) {
    await this.rates.consumeInvite(readClientAddress(request), context.tenantId, context.userId);
    const resent = await this.resendInvitation.resend(
      context,
      invitationId,
      body.locale ?? 'en',
      invitationAuditClient(request, this.auditIpHashKey),
    );
    return { data: resent };
  }

  @Post('invitations/:invitationId/revoke')
  @Authorize('members:invite')
  @HttpCode(204)
  async revoke(
    @CurrentRequest() context: RequestContext,
    @ZodParam('invitationId', invitationIdSchema) invitationId: string,
    @Req() request: InvitationHttpRequest,
  ): Promise<void> {
    await this.rates.consumeInvite(readClientAddress(request), context.tenantId, context.userId);
    await this.revokeInvitation.revoke(
      context,
      invitationId,
      invitationAuditClient(request, this.auditIpHashKey),
    );
  }
}
