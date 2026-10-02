import { Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';

import { Public } from '../../../common/auth/public';
import { ZodBody } from '../../../common/pipes/zod-input';
import { readClientAddress } from '../../../common/security/client-address';
import { AuthRateLimitService } from '../../identity/application/auth-rate-limit.service';
import { SessionCookie, type SessionCookieWriter } from '../../identity/infrastructure/session-cookie';
import { AcceptInvitationService } from '../application/accept-invitation.service';
import {
  acceptInvitationSchema,
  previewInvitationSchema,
  type AcceptInvitationBody,
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
    @Inject(AUDIT_IP_HASH_KEY) private readonly auditIpHashKey: string | null,
  ) {}

  @Public()
  @Post('preview')
  @HttpCode(200)
  async preview(@ZodBody(previewInvitationSchema) body: PreviewInvitationBody, @Req() request: InvitationHttpRequest) {
    await this.rates.consumeAccept(readClientAddress(request));
    const preview = await this.acceptInvitation.preview(body.invitationId, body.token);
    return { data: preview };
  }

  @Public()
  @Post('accept')
  @HttpCode(200)
  async accept(
    @ZodBody(acceptInvitationSchema) body: AcceptInvitationBody,
    @Req() request: InvitationHttpRequest,
    @Res({ passthrough: true }) response: SessionCookieWriter,
  ) {
    await this.rates.consumeAccept(readClientAddress(request));
    const accepted = await this.acceptInvitation.accept(
      { ...body, requestId: readInvitationRequestId(request) },
      invitationAuditClient(request, this.auditIpHashKey),
    );
    this.sessionCookie.set(response, accepted.rawSessionId);
    return { data: accepted.account };
  }
}
