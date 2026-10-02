import { Module } from '@nestjs/common';

import { AUDIT_IP_HASH_KEY, readAuditIpHashKey } from '../../common/audit/audit-ip-hash';
import { AuditModule } from '../../common/audit/audit.module';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { DatabaseModule } from '../../common/database/database.module';
import { OrganizationsModule } from '../organizations';
import { AuthRateLimitService } from './application/auth-rate-limit.service';
import { LoginService } from './application/login.service';
import { LogoutService } from './application/logout.service';
import { RegisterService } from './application/register.service';
import { SessionAccessService } from './application/session-access.service';
import { TerminateUserSessionsService } from './application/terminate-user-sessions.service';
import { PASSWORD_HASHER } from './domain/password-hasher';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher';
import { INCIDENT_LOGGER, NestIncidentLogger } from './infrastructure/incident-logger';
import { PrismaLoginAccountStore } from './infrastructure/prisma-login-account';
import { PrismaSessionUserStore } from './infrastructure/prisma-session-user';
import { AUTH_RATE_LIMITS, readAuthRateLimitConfig } from './infrastructure/rate-limit-config';
import { RATE_LIMIT_REDIS } from './infrastructure/rate-limit-redis';
import { RedisSessionStore } from './infrastructure/redis-session.store';
import {
  readRegistrationEnabled,
  REGISTRATION_ENABLED,
} from './infrastructure/registration-config';
import { readSessionCookieSecure, SessionCookie } from './infrastructure/session-cookie';
import { SESSION_REDIS, type SessionRedisClient } from './infrastructure/session-redis';
import { createRateLimitRedisClient } from './infrastructure/upstash-rate-limit-redis';
import { createSessionRedisClient } from './infrastructure/upstash-session-redis';
import { AuthController } from './presentation/auth.controller';
import { SessionController } from './presentation/session.controller';
import { SessionGuard } from './presentation/session.guard';

@Module({
  imports: [AuditModule, AuthorizationModule, OrganizationsModule, DatabaseModule],
  controllers: [AuthController, SessionController],
  providers: [
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: SessionCookie, useFactory: () => new SessionCookie(readSessionCookieSecure()) },
    { provide: REGISTRATION_ENABLED, useFactory: () => readRegistrationEnabled() },
    { provide: SESSION_REDIS, useFactory: () => createSessionRedisClient() },
    { provide: RATE_LIMIT_REDIS, useFactory: () => createRateLimitRedisClient() },
    { provide: AUTH_RATE_LIMITS, useFactory: () => readAuthRateLimitConfig() },
    { provide: INCIDENT_LOGGER, useClass: NestIncidentLogger },
    {
      provide: RedisSessionStore,
      useFactory: (redis: SessionRedisClient, users: PrismaSessionUserStore): RedisSessionStore =>
        new RedisSessionStore(redis, users),
      inject: [SESSION_REDIS, PrismaSessionUserStore],
    },
    { provide: AUDIT_IP_HASH_KEY, useFactory: () => readAuditIpHashKey() },
    PrismaLoginAccountStore,
    PrismaSessionUserStore,
    RegisterService,
    LoginService,
    SessionAccessService,
    SessionGuard,
    LogoutService,
    TerminateUserSessionsService,
    AuthRateLimitService,
  ],
  exports: [
    SessionGuard,
    AUDIT_IP_HASH_KEY,
    PASSWORD_HASHER,
    RedisSessionStore,
    INCIDENT_LOGGER,
    SessionCookie,
    AuthRateLimitService,
  ],
})
export class IdentityModule {}
