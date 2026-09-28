import { CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';

import { ApiError, apiErrorCodes } from '../http/api-error';
import { ALLOWED_ORIGINS } from './allowed-origins';
import { isOriginAllowed, type OriginHeaders } from './origin-policy';

type OriginRequest = {
  method?: string;
  headers: OriginHeaders;
};

/**
 * Fail-closed check for cookie-authenticated mutations.
 * SameSite=Lax does not replace it. CORS does not replace it: CORS does not stop a
 * cross-site form post or a non-browser client.
 * If the frontend and the API are on different sites, the browser will not send a
 * SameSite=Lax cookie on those requests. That deployment needs SameSite=None and a CSRF token.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowed: ReadonlySet<string>;

  constructor(@Inject(ALLOWED_ORIGINS) origins: readonly string[]) {
    this.allowed = new Set(origins);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<OriginRequest>();
    const method = request.method ?? 'GET';
    if (isOriginAllowed(method, request.headers, this.allowed)) {
      return true;
    }

    throw new ApiError(apiErrorCodes.ORIGIN_REJECTED);
  }
}
