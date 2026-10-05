import { Controller, HttpCode, Inject, Post, Req } from '@nestjs/common';

import { AUDIT_IP_HASH_KEY, hashAuditIp } from '../../../common/audit/audit-ip-hash';
import { Public } from '../../../common/auth/public';
import { createRequestId, currentRequestId } from '../../../common/http/request-context';
import { ZodBody } from '../../../common/pipes/zod-input';
import { readClientAddress } from '../../../common/security/client-address';
import { AuthRateLimitService } from '../application/auth-rate-limit.service';
import { ConfirmPasswordResetService } from '../application/confirm-password-reset.service';
import { RequestPasswordResetService } from '../application/request-password-reset.service';
import type { AuditClient } from '../application/terminate-user-sessions.service';
import {
  confirmPasswordResetSchema,
  requestPasswordResetSchema,
  type ConfirmPasswordResetBody,
  type RequestPasswordResetBody,
} from './dto/password-reset.schema';

type PasswordResetRequest = {
  requestId?: string;
  headers?: { 'user-agent'?: string | string[] };
  ip?: string;
  socket?: { remoteAddress?: string };
};

@Controller('auth/password-resets')
export class PasswordResetController {
  constructor(
    private readonly requestReset: RequestPasswordResetService,
    private readonly confirmReset: ConfirmPasswordResetService,
    private readonly rates: AuthRateLimitService,
    @Inject(AUDIT_IP_HASH_KEY) private readonly auditIpHashKey: string | null,
  ) {}

  /** Always succeeds when recovery is configured, including for an unknown account. */
  @Public()
  @Post()
  @HttpCode(204)
  async request(
    @ZodBody(requestPasswordResetSchema) body: RequestPasswordResetBody,
    @Req() request: PasswordResetRequest,
  ): Promise<void> {
    await this.rates.consumePasswordResetRequest(
      readClientAddress(request),
      body.subdomain,
      body.email,
    );
    await this.requestReset.request(body);
  }

  @Public()
  @Post('confirm')
  @HttpCode(204)
  async confirm(
    @ZodBody(confirmPasswordResetSchema) body: ConfirmPasswordResetBody,
    @Req() request: PasswordResetRequest,
  ): Promise<void> {
    await this.rates.consumePasswordResetConfirm(readClientAddress(request));
    await this.confirmReset.confirm({
      token: body.token,
      password: body.password,
      requestId: readPasswordResetRequestId(request),
      client: passwordResetAuditClient(request, this.auditIpHashKey),
    });
  }
}

function readPasswordResetRequestId(request: PasswordResetRequest): string {
  const stored = currentRequestId();
  if (stored !== undefined && stored.length > 0) {
    return stored;
  }
  if (request.requestId !== undefined && request.requestId.length > 0) {
    return request.requestId;
  }
  return createRequestId();
}

function passwordResetAuditClient(request: PasswordResetRequest, key: string | null): AuditClient {
  const address = readClientAddress(request);
  return {
    ipHash: address === null || key === null ? null : hashAuditIp(address, key),
    userAgent: readUserAgent(request),
  };
}

function readUserAgent(request: PasswordResetRequest): string | null {
  const raw = request.headers?.['user-agent'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim() ?? '';
  if (trimmed.length === 0 || trimmed.length > 256) {
    return null;
  }
  return trimmed;
}
