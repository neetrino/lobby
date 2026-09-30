import { Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import type { AuthenticatedSession } from '../../../common/auth/authenticated-session';
import { CurrentSession } from '../../../common/auth/current-request';
import { RoleGuard, Roles } from '../../../common/auth/role.guard';
import { ZodParam } from '../../../common/pipes/zod-input';
import { tenantManagerRoles } from '../../../common/tenant/authenticated-tenant-context';
import type { SessionRevocationActor } from '../domain/session-revocation';
import { TerminateUserSessionsService } from '../application/terminate-user-sessions.service';
import { SessionCookie, type SessionCookieWriter } from '../infrastructure/session-cookie';
import { SessionGuard } from './session.guard';

const userIdSchema = z.uuid();

export type SessionView = {
  user: { id: string; role: AuthenticatedSession['role'] };
  tenant: { id: string };
};

@Controller('auth')
@UseGuards(SessionGuard)
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
   * The route allow-list is repeated inside TerminateUserSessionsService.
   * A user in another tenant is rejected there, including calls that skip this guard.
   */
  @Post('users/:userId/sessions/terminate')
  @Roles(...tenantManagerRoles)
  @UseGuards(RoleGuard)
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
