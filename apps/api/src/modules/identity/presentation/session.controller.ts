import { Controller, Get, HttpCode, Post, Res, UseFilters, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import type { AuthenticatedSession } from '../../../common/auth/authenticated-session';
import { ZodParam } from '../../../common/pipes/zod-input';
import type { SessionRevocationActor } from '../domain/session-revocation';
import { TerminateUserSessionsService } from '../application/terminate-user-sessions.service';
import { SessionCookie, type SessionCookieWriter } from '../infrastructure/session-cookie';
import { CurrentSession } from './current-session';
import { IdentityExceptionFilter } from './identity-exception.filter';
import { SessionGuard } from './session.guard';

const userIdSchema = z.uuid();

export type SessionView = {
  user: { id: string; role: AuthenticatedSession['role'] };
  tenant: { id: string };
};

@Controller('auth')
@UseGuards(SessionGuard)
@UseFilters(IdentityExceptionFilter)
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
  ): Promise<void> {
    await this.terminateSessions.terminateAllSessions(actorFrom(current), current.userId);
    this.sessionCookie.clear(response);
  }

  /**
   * Revokes one user's sessions inside the caller's tenant.
   * Permission is decided by the application service. A user in another tenant is rejected.
   */
  @Post('users/:userId/sessions/terminate')
  @HttpCode(204)
  async terminateUser(
    @CurrentSession() current: AuthenticatedSession,
    @ZodParam('userId', userIdSchema) userId: string,
  ): Promise<void> {
    await this.terminateSessions.terminateAllSessions(actorFrom(current), userId);
  }
}

function actorFrom(current: AuthenticatedSession): SessionRevocationActor {
  return { userId: current.userId, tenantId: current.tenantId, role: current.role };
}
