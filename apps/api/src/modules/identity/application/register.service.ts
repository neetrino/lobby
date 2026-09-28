import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';

import { CreateTenantService } from '../../organizations';
import { IdentityError, identityErrorCodes } from '../domain/identity.errors';
import { PASSWORD_HASHER, type PasswordHasher } from '../domain/password-hasher';
import { sessionRoles, type SessionRole } from '../domain/authenticated-session';
import { INCIDENT_LOGGER, type IncidentLogger } from '../infrastructure/incident-logger';
import { RedisSessionStore, StaleSessionError } from '../infrastructure/redis-session.store';
import { REGISTRATION_ENABLED } from '../infrastructure/registration-config';
import { type RegisterInput } from '../presentation/dto/register.schema';

const REGISTRATION_FAILED = 'Tenant registration failed.';

const prismaConflictSchema = z.object({
  code: z.literal('P2002'),
  meta: z
    .object({
      target: z.union([z.string(), z.array(z.string())]).optional(),
    })
    .optional(),
});

export type RegisteredAccount = {
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

export type RegisteredSession = {
  account: RegisteredAccount;
  rawSessionId: string;
};

type CreatedOwner = Awaited<ReturnType<CreateTenantService['createWithOwner']>>;

@Injectable()
export class RegisterService {
  constructor(
    private readonly tenants: CreateTenantService,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher,
    private readonly sessions: RedisSessionStore,
    @Inject(REGISTRATION_ENABLED) private readonly registrationEnabled: boolean,
    @Inject(INCIDENT_LOGGER) private readonly incidents: IncidentLogger,
  ) {}

  async register(input: RegisterInput): Promise<RegisteredSession> {
    if (!this.registrationEnabled) {
      throw new IdentityError(identityErrorCodes.REGISTRATION_DISABLED);
    }

    await this.ensureSessionStore();
    const created = await this.createOwner(input);
    return this.openSession(created);
  }

  private async ensureSessionStore(): Promise<void> {
    try {
      await this.sessions.ping();
    } catch {
      this.incidents.error('Session store is unavailable.');
      throw new IdentityError(identityErrorCodes.SERVICE_UNAVAILABLE);
    }
  }

  private async createOwner(input: RegisterInput) {
    const passwordHash = await this.passwords.hash(input.owner.password);

    try {
      return await this.tenants.createWithOwner({
        tenant: input.tenant,
        owner: {
          name: input.owner.name,
          email: input.owner.email,
          passwordHash,
        },
      });
    } catch (error) {
      if (isSubdomainConflict(error)) {
        throw new IdentityError(identityErrorCodes.TENANT_SUBDOMAIN_TAKEN);
      }
      this.incidents.error(REGISTRATION_FAILED);
      throw new Error(REGISTRATION_FAILED);
    }
  }

  private async openSession(created: CreatedOwner): Promise<RegisteredSession> {
    let rawSessionId: string;
    try {
      const opened = await this.sessions.create(
        {
          userId: created.user.id,
          tenantId: created.tenant.id,
          role: created.user.role,
          authenticationVersion: created.user.authenticationVersion,
        },
        new Date(),
      );
      rawSessionId = opened.rawSessionId;
    } catch (error) {
      if (!(error instanceof StaleSessionError)) {
        this.incidents.error(
          `Registration committed but the session was not created. tenantId=${created.tenant.id} userId=${created.user.id}`,
        );
      }
      throw new IdentityError(identityErrorCodes.ACCOUNT_CREATED_SIGN_IN_REQUIRED);
    }

    return { account: toRegisteredAccount(created), rawSessionId };
  }
}

function toRegisteredAccount(created: {
  tenant: { id: string; name: string; subdomain: string };
  user: { id: string; name: string; email: string; role: string };
}): RegisteredAccount {
  const role = sessionRoles.find((value) => value === created.user.role);
  if (role === undefined) {
    throw new Error(REGISTRATION_FAILED);
  }

  return {
    tenant: {
      id: created.tenant.id,
      name: created.tenant.name,
      subdomain: created.tenant.subdomain,
      plan: 'starter',
    },
    user: {
      id: created.user.id,
      name: created.user.name,
      email: created.user.email,
      role,
    },
  };
}

function isSubdomainConflict(error: unknown): boolean {
  const parsed = prismaConflictSchema.safeParse(error);
  if (!parsed.success) {
    return false;
  }

  const target = parsed.data.meta?.target;
  if (target === undefined) {
    return true;
  }

  const fields = Array.isArray(target) ? target : [target];
  return fields.some((field) => field.includes('subdomain'));
}
