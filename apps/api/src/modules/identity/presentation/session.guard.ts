import { CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';

import type { AuthenticatedSession } from '../../../common/auth/authenticated-session';
import { ApiError } from '../../../common/http/api-error';
import { readClientAddress } from '../../../common/security/client-address';
import { AuthRateLimitService } from '../application/auth-rate-limit.service';
import { SessionAccessService } from '../application/session-access.service';
import { IdentityError, identityErrorCodes } from '../domain/identity.errors';
import { SessionCookie, type SessionCookieWriter } from '../infrastructure/session-cookie';

export type SessionRequest = {
  headers: { cookie?: string | readonly string[] };
  auth?: AuthenticatedSession;
  ip?: string;
  socket?: { remoteAddress?: string };
};

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly access: SessionAccessService,
    private readonly cookies: SessionCookie,
    private readonly rates: AuthRateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const response = context.switchToHttp().getResponse<SessionCookieWriter>();
    const rawSessionId = this.cookies.read(request.headers.cookie);
    const presented = hasSessionCookie(request.headers.cookie);

    try {
      if (rawSessionId === null) {
        throw new IdentityError(identityErrorCodes.UNAUTHENTICATED);
      }
      request.auth = await this.access.establish(rawSessionId, new Date());
      return true;
    } catch (error) {
      return this.reject(response, presented ? readClientAddress(request) : null, error);
    }
  }

  private async reject(
    response: SessionCookieWriter,
    address: string | null,
    error: unknown,
  ): Promise<boolean> {
    if (error instanceof ApiError) {
      this.cookies.clear(response);
      throw error;
    }
    if (!(error instanceof IdentityError)) {
      throw error;
    }

    this.cookies.clear(response);
    if (address !== null) {
      await this.rates.recordInvalidSession(address);
    }
    throw error;
  }
}

function hasSessionCookie(cookieHeader: string | readonly string[] | undefined): boolean {
  const header = typeof cookieHeader === 'string' ? cookieHeader : cookieHeader?.join('; ');
  if (header === undefined) {
    return false;
  }
  return header.split(';').some((part) => part.trim().startsWith('session='));
}
