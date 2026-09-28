import { Inject, Injectable } from '@nestjs/common';

import { IdentityError, identityErrorCodes } from '../domain/identity.errors';
import { PASSWORD_HASHER, type PasswordHasher } from '../domain/password-hasher';
import { sessionRoles, type SessionRole } from '../domain/authenticated-session';
import { INCIDENT_LOGGER, type IncidentLogger } from '../infrastructure/incident-logger';
import { PrismaLoginAccountStore, type LoginAccount } from '../infrastructure/prisma-login-account';
import { RedisSessionStore, StaleSessionError } from '../infrastructure/redis-session.store';
import { UNKNOWN_USER_PASSWORD_HASH } from '../infrastructure/unknown-user-password-hash';
import { type LoginInput } from '../presentation/dto/login.schema';

const LOGIN_FAILED = 'Login could not be completed.';
const SESSION_STORE_UNAVAILABLE = 'Session store is unavailable.';

export type SignedInAccount = {
  tenant: {
    id: string;
    name: string;
    subdomain: string;
    plan: 'starter';
  };
  user: {
    id: string;
    name: string;
    email: string;
    role: SessionRole;
  };
};

export type SignedInSession = {
  account: SignedInAccount;
  rawSessionId: string;
};

@Injectable()
export class LoginService {
  constructor(
    private readonly accounts: PrismaLoginAccountStore,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher,
    private readonly sessions: RedisSessionStore,
    @Inject(INCIDENT_LOGGER) private readonly incidents: IncidentLogger,
  ) {}

  /**
   * Checks subdomain, email, status, and password, then opens a new session.
   * Missing accounts and disabled users pay the same Argon2id verification as a real check.
   * The caller must not pass an existing cookie: every success mints a new session id.
   */
  async login(input: LoginInput): Promise<SignedInSession> {
    const account = await this.accounts.findBySubdomainAndEmail(input.subdomain, input.email);
    if (!isActiveAccount(account)) {
      await this.passwords.verify(UNKNOWN_USER_PASSWORD_HASH, input.password);
      throw new IdentityError(identityErrorCodes.INVALID_CREDENTIALS);
    }

    const passwordMatches = await this.passwords.verify(account.user.passwordHash, input.password);
    if (!passwordMatches) {
      throw new IdentityError(identityErrorCodes.INVALID_CREDENTIALS);
    }

    return this.openSession(account);
  }

  private async openSession(account: LoginAccount): Promise<SignedInSession> {
    const role = sessionRoles.find((value) => value === account.user.role);
    if (role === undefined) {
      throw new Error(LOGIN_FAILED);
    }

    try {
      const opened = await this.sessions.create(
        {
          userId: account.user.id,
          tenantId: account.tenant.id,
          role,
          authenticationVersion: account.user.authenticationVersion,
        },
        new Date(),
      );
      return { account: toSignedInAccount(account, role), rawSessionId: opened.rawSessionId };
    } catch (error) {
      if (error instanceof StaleSessionError) {
        throw new IdentityError(identityErrorCodes.SESSION_REVOKED);
      }
      this.incidents.error(
        `Login succeeded but the session was not created. tenantId=${account.tenant.id} userId=${account.user.id}`,
      );
      throw new Error(SESSION_STORE_UNAVAILABLE);
    }
  }
}

function isActiveAccount(account: LoginAccount | null): account is LoginAccount {
  return account !== null && account.user.status === 'ACTIVE';
}

function toSignedInAccount(account: LoginAccount, role: SessionRole): SignedInAccount {
  return {
    tenant: {
      id: account.tenant.id,
      name: account.tenant.name,
      subdomain: account.tenant.subdomain,
      plan: 'starter',
    },
    user: {
      id: account.user.id,
      name: account.user.name,
      email: account.user.email,
      role,
    },
  };
}
