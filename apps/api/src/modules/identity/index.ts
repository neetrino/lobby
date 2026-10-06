export { PASSWORD_HASHER, type PasswordHasher } from './domain/password-hasher';
export {
  IdentityError,
  identityErrorCodes,
  type IdentityErrorCode,
} from './domain/identity.errors';
export {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordPolicySchema,
  type Password,
} from './domain/password-policy';
export { AuthRateLimitService } from './application/auth-rate-limit.service';
export type { AuditClient } from './application/terminate-user-sessions.service';
export { IdentityModule } from './identity.module';
export { INCIDENT_LOGGER, type IncidentLogger } from './infrastructure/incident-logger';
export { RedisSessionStore, StaleSessionError } from './infrastructure/redis-session.store';
export {
  SessionCookie,
  readSessionCookieSecure,
  type SessionCookieWriter,
} from './infrastructure/session-cookie';
export { SessionGuard } from './presentation/session.guard';
export { UNKNOWN_USER_PASSWORD_HASH } from './infrastructure/unknown-user-password-hash';
export { readAuthRateLimitConfig } from './infrastructure/rate-limit-config';
export { readSessionRedisTimeoutMs } from './infrastructure/upstash-session-redis';
