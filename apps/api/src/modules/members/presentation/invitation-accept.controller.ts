import { Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';

import { Public } from '../../../common/auth/public';
import { ZodBody } from '../../../common/pipes/zod-input';
import { readClientAddress } from '../../../common/security/client-address';
import { AuthRateLimitService } from '../../identity/application/auth-rate-limit.service';
import { SessionCookie, type SessionCookieWriter } from '../../identity/infrastructure/session-cookie';
import { AcceptInvitationService } from '../application/accept-invitation.service';
import {
  InvitationAccessCookie,
  type InvitationCookieWriter,
} from '../infrastructure/invitation-access-cookie';
import {
  acceptInvitationSchema,
  exchangeInvitationSchema,
  previewInvitationSchema,
  type AcceptInvitationBody,
  type ExchangeInvitationBody,
  type PreviewInvitationBody,
} from './dto/invitation.schema';
import {
  AUDIT_IP_HASH_KEY,
  invitationAuditClient,
  readInvitationRequestId,
  type InvitationHttpRequest,
} from './invitation-request';

@Controller('auth/invitations')
export class InvitationAcceptController {
  constructor(
    private readonly acceptInvitation: AcceptInvitationService,
    private readonly rates: AuthRateLimitService,
    private readonly sessionCookie: SessionCookie,
    private readonly accessCookie: InvitationAccessCookie,
    @Inject(AUDIT_IP_HASH_KEY) private readonly auditIpHashKey: string | null,
  ) {}

  @Public()
  @Post('exchange')
  @HttpCode(200)
  async exchange(
    @ZodBody(exchangeInvitationSchema) body: ExchangeInvitationBody,
    @Req() request: InvitationHttpRequest,
    @Res({ passthrough: true }) response: InvitationCookieWriter,
  ) {
    await this.rates.consumeAccept(readClientAddress(request));
    const issued = await this.acceptInvitation.exchange(body.invitationId, body.token, new Date());
    this.accessCookie.set(response, issued.sealed, issued.maxAgeMs);
    return { data: { invitationId: body.invitationId } };
  }

  @Public()
  @Post('preview')
  @HttpCode(200)
  async preview(@ZodBody(previewInvitationSchema) body: PreviewInvitationBody, @Req() request: InvitationHttpRequest) {
    await this.rates.consumeAccept(readClientAddress(request));
    const preview = await this.acceptInvitation.preview(body.invitationId, request.headers?.cookie);
    return { data: preview };
  }

  @Public()
  @Post('accept')
  @HttpCode(200)
  async accept(
    @ZodBody(acceptInvitationSchema) body: AcceptInvitationBody,
    @Req() request: InvitationHttpRequest,
    @Res({ passthrough: true }) response: SessionCookieWriter & InvitationCookieWriter,
  ) {
    await this.rates.consumeAccept(readClientAddress(request));
    const accepted = await this.acceptInvitation.accept(
      { ...body, requestId: readInvitationRequestId(request) },
      request.headers?.cookie,
      invitationAuditClient(request, this.auditIpHashKey),
    );
    this.sessionCookie.set(response, accepted.rawSessionId);
    this.accessCookie.clear(response);
    return { data: accepted.account };
  }
}
