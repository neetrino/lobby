import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { z } from 'zod';

import type { AuthenticatedSession } from '../../../common/auth/authenticated-session';
import { CurrentSession } from '../../../common/auth/current-request';
import { Authorize } from '../../../common/authorization/permission.guard';
import { currentRequestId } from '../../../common/http/request-context';
import { ZodParam } from '../../../common/pipes/zod-input';
import { readClientAddress } from '../../../common/security/client-address';
import { requestContextFromSession } from '../../../common/tenant/request-context';
import { TerminateUserSessionsService, type AuditClient } from '../application/terminate-user-sessions.service';
import { hashRateLimitSubject } from '../infrastructure/rate-limit-keys';
import { SessionCookie, type SessionCookieWriter } from '../infrastructure/session-cookie';

const userIdSchema = z.uuid();

export type SessionView = {
  user: { id: string; role: AuthenticatedSession['role'] };
  tenant: { id: string };
};

@Controller('auth')
export class SessionController {
  constructor(
    private readonly terminateSessions: TerminateUserSessionsService,
    private readonly sessionCookie: SessionCookie,
  ) {}

  /** Safe principal. The raw session id and password hash are not included. */
  @Get('session')
  session(@CurrentSession() current: AuthenticatedSession): { data: SessionView } {
    return {
      data: {
        user: { id: current.userId, role: current.role },
        tenant: { id: current.tenantId },
      },
    };
  }

  /** Revokes every session of the caller, including the cookie used for this request. */
  @Post('sessions/terminate-all')
  @HttpCode(204)
  async terminateAll(
    @CurrentSession() current: AuthenticatedSession,
    @Res({ passthrough: true }) response: SessionCookieWriter,
    @Req() request: TerminateRequest,
  ): Promise<void> {
    await this.terminateSessions.terminateAllSessions(
      requestContextFromSession(current, readRequestId(request)),
      current.userId,
      auditClient(request),
    );
    this.sessionCookie.clear(response);
  }

  /**
   * Revokes one user's sessions inside the caller's tenant.
   * The route requires sessions:revoke. The service repeats that rule through canRevokeUserSessions.
   * A user in another tenant is rejected there, including calls that skip this guard.
   */
  @Post('users/:userId/sessions/terminate')
  @Authorize('sessions:revoke')
  @HttpCode(204)
  async terminateUser(
    @CurrentSession() current: AuthenticatedSession,
    @ZodParam('userId', userIdSchema) userId: string,
    @Req() request: TerminateRequest,
  ): Promise<void> {
    await this.terminateSessions.terminateAllSessions(
      requestContextFromSession(current, readRequestId(request)),
      userId,
      auditClient(request),
    );
  }
}

type TerminateRequest = {
  requestId?: string;
  headers?: { 'user-agent'?: string | string[] };
  ip?: string;
  socket?: { remoteAddress?: string };
};

function readRequestId(request: TerminateRequest): string {
  const stored = currentRequestId();
  if (stored !== undefined && stored.length > 0) {
    return stored;
  }
  if (request.requestId !== undefined && request.requestId.length > 0) {
    return request.requestId;
  }
  throw new Error('Request id is missing');
}

function auditClient(request: TerminateRequest): AuditClient {
  const address = readClientAddress(request);
  return {
    ipHash: address === null ? null : hashRateLimitSubject(address),
    userAgent: readUserAgent(request),
  };
}

function readUserAgent(request: TerminateRequest): string | null {
  const raw = request.headers?.['user-agent'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim() ?? '';
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.slice(0, 256);
}
