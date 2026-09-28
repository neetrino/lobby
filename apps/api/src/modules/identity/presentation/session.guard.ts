import { CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';

import type { AuthenticatedSession } from '../../../common/auth/authenticated-session';
import { SessionAccessService } from '../application/session-access.service';
import { IdentityError, identityErrorCodes } from '../domain/identity.errors';
import { SessionCookie, type SessionCookieWriter } from '../infrastructure/session-cookie';

export type SessionRequest = {
  headers: { cookie?: string | readonly string[] };
  auth?: AuthenticatedSession;
};

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly access: SessionAccessService,
    private readonly cookies: SessionCookie,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const response = context.switchToHttp().getResponse<SessionCookieWriter>();
    const rawSessionId = this.cookies.read(request.headers.cookie);

    try {
      if (rawSessionId === null) {
        throw new IdentityError(identityErrorCodes.UNAUTHENTICATED);
      }
      request.auth = await this.access.establish(rawSessionId, new Date());
      return true;
    } catch (error) {
      if (error instanceof IdentityError) {
        this.cookies.clear(response);
      }
      throw error;
    }
  }
}
