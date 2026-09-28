import { Module } from '@nestjs/common';

import { OutboxModule } from '../../common/outbox';
import { OrganizationsModule } from '../organizations';
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
import { RedisSessionStore } from './infrastructure/redis-session.store';
import {
  readRegistrationEnabled,
  REGISTRATION_ENABLED,
} from './infrastructure/registration-config';
import { readSessionCookieSecure, SessionCookie } from './infrastructure/session-cookie';
import { SESSION_REDIS } from './infrastructure/session-redis';
import { createSessionRedisClient } from './infrastructure/upstash-session-redis';
import { AuthController } from './presentation/auth.controller';
import { SessionGuard } from './presentation/session.guard';

@Module({
  imports: [OrganizationsModule, OutboxModule],
  controllers: [AuthController],
  providers: [
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: SessionCookie, useFactory: () => new SessionCookie(readSessionCookieSecure()) },
    { provide: REGISTRATION_ENABLED, useFactory: () => readRegistrationEnabled() },
    { provide: SESSION_REDIS, useFactory: () => createSessionRedisClient() },
    { provide: INCIDENT_LOGGER, useClass: NestIncidentLogger },
    RedisSessionStore,
    PrismaLoginAccountStore,
    PrismaSessionUserStore,
    RegisterService,
    LoginService,
    SessionAccessService,
    SessionGuard,
    LogoutService,
    TerminateUserSessionsService,
  ],
  exports: [PASSWORD_HASHER, SessionGuard],
})
export class IdentityModule {}
