import type { CanActivate, ExecutionContext } from '@nestjs/common';

import type { AuthenticatedSession } from './authenticated-session';

/**
 * HTTP request a session guard authenticates.
 * `auth` is set only from the validated session. Body, query, and headers are not a tenant source.
 */
export type AuthenticatedHttpRequest = {
  headers: { cookie?: string | readonly string[] };
  auth?: AuthenticatedSession;
  ip?: string;
  socket?: { remoteAddress?: string };
};

/**
 * Contract for the guard that attaches `request.auth`.
 * The Identity module owns the implementation. Other modules apply that class with `@UseGuards`.
 */
export interface SessionGuardContract extends CanActivate {
  canActivate(context: ExecutionContext): Promise<boolean>;
}
