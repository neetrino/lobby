import { Inject, Optional, type ExecutionContext, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import {
  type AuthenticatedHttpRequest,
  type SessionGuardContract,
} from '../../../common/auth/session-guard.contract';
import { ApiError } from '../../../common/http/api-error';
import { readClientAddress } from '../../../common/security/client-address';
import { AuthRateLimitService } from '../application/auth-rate-limit.service';
import { SessionAccessService } from '../application/session-access.service';
import { IdentityError, identityErrorCodes } from '../domain/identity.errors';
import { SessionCookie, type SessionCookieWriter } from '../infrastructure/session-cookie';
import { SessionStoreUnavailableError } from '../infrastructure/session-store-error';

export type SessionRequest = AuthenticatedHttpRequest;

type GuardServices = {
  access: SessionAccessService;
  cookies: SessionCookie;
  rates: AuthRateLimitService;
};

@Injectable()
export class SessionGuard implements SessionGuardContract {
  constructor(
    @Optional() @Inject(SessionAccessService) private readonly access?: SessionAccessService,
    @Optional() @Inject(SessionCookie) private readonly cookies?: SessionCookie,
    @Optional() @Inject(AuthRateLimitService) private readonly rates?: AuthRateLimitService,
    @Optional() @Inject(ModuleRef) private readonly modules?: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedHttpRequest>();
    const response = context.switchToHttp().getResponse<SessionCookieWriter>();
    const guard = this.services();
    const rawSessionId = guard.cookies.read(request.headers.cookie);
    const presented = hasSessionCookie(request.headers.cookie);

    try {
      if (rawSessionId === null) {
        throw new IdentityError(identityErrorCodes.UNAUTHENTICATED);
      }
      const established = await guard.access.establish(rawSessionId, new Date());
      request.auth = established.session;
      if (established.refreshed && established.maxAgeMs > 0) {
        guard.cookies.set(response, rawSessionId, established.maxAgeMs);
      }
      return true;
    } catch (error) {
      if (error instanceof SessionStoreUnavailableError) {
        throw new IdentityError(identityErrorCodes.UNAUTHENTICATED);
      }
      return this.reject(guard, response, presented ? readClientAddress(request) : null, error);
    }
  }

  /**
   * The controller module does not receive Identity's internal providers.
   * That instance loads the same services through ModuleRef.
   */
  private services(): GuardServices {
    if (this.access !== undefined && this.cookies !== undefined && this.rates !== undefined) {
      return { access: this.access, cookies: this.cookies, rates: this.rates };
    }
    if (this.modules === undefined) {
      throw new Error('Session guard dependencies are missing');
    }
    return {
      access: this.modules.get(SessionAccessService, { strict: false }),
      cookies: this.modules.get(SessionCookie, { strict: false }),
      rates: this.modules.get(AuthRateLimitService, { strict: false }),
    };
  }

  private async reject(
    guard: GuardServices,
    response: SessionCookieWriter,
    address: string | null,
    error: unknown,
  ): Promise<boolean> {
    if (error instanceof ApiError) {
      guard.cookies.clear(response);
      throw error;
    }
    if (!(error instanceof IdentityError)) {
      throw error;
    }

    guard.cookies.clear(response);
    if (address !== null) {
      await guard.rates.recordInvalidSession(address);
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
