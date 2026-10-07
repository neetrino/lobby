import {
  createTestPrismaClient,
  disposeTestPrismaClient,
  type PrismaClient,
} from '@lobby/database/testing';
import type { ExecutionContext } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthorizationError } from '../../../common/auth/authorization';
import { PLATFORM_SUBDOMAIN } from '../../../common/platform/platform-subdomain';
import { PlanEntitlementGrant } from '../../../common/modules/plan-entitlement-grant';
import { OutboxService } from '../../../common/outbox/outbox.service';
import { clearTestTenantData } from '../../../testing/clear-test-tenant-data';
import { IdentityError, type PasswordHasher } from '../../identity';
import { CreateTenantService } from '../../organizations';
import { PlatformAdminService } from './platform-admin.service';
import { ProvisionOrganizationService } from './provision-organization.service';
import { PlatformOperatorGuard } from '../presentation/platform-operator.guard';

const password = 'correct-horse-battery';
const passwordHash =
  '$argon2id$v=19$m=65536,p=4,t=3$PEbBsUzxZ+rLvTW4czR4Ww$GiSsH9i7n0l40OGimI/KV+2Gf6GNJvf5MiPpVuIqXb8';

const hasher: PasswordHasher = {
  hash: () => Promise.resolve(passwordHash),
  verify: () => Promise.resolve(true),
};

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
});

afterAll(async () => {
  await clearTestTenantData(prisma);
  await disposeTestPrismaClient(prisma);
});

beforeEach(async () => {
  await clearTestTenantData(prisma);
});

describe('platform organizations', () => {
  it('creates a customer owner without adding the platform operator', async () => {
    const admin = new PlatformAdminService(prisma, hasher);
    expect(await admin.ensure({ name: 'Operator', email: 'Root@Example.com', password })).toBe('created');
    expect(await admin.ensure({ name: 'Operator', email: 'Root@Example.com', password })).toBe('exists');

    const created = await organizations().create({
      tenant: { name: 'North', subdomain: 'North' },
      owner: { name: 'Nia', email: 'Nia@Example.com', password },
    });
    expect(created).toEqual({ name: 'North', subdomain: 'north', ownerEmail: 'nia@example.com' });

    const northUsers = await prisma.user.findMany({ where: { tenant: { subdomain: 'north' } } });
    expect(northUsers.map((user) => user.email)).toEqual(['nia@example.com']);
    expect(await prisma.pipeline.count({ where: { tenant: { subdomain: 'north' } } })).toBe(2);

    const listed = await organizations().list();
    expect(listed.map((row) => row.subdomain)).toEqual(['north']);
    expect(listed.some((row) => row.subdomain === PLATFORM_SUBDOMAIN)).toBe(false);
  });

  it('refuses the reserved platform subdomain', async () => {
    await expect(
      organizations().create({
        tenant: { name: 'Platform', subdomain: PLATFORM_SUBDOMAIN },
        owner: { name: 'Nia', email: 'nia@example.com', password },
      }),
    ).rejects.toBeInstanceOf(IdentityError);
  });

  it('allows only the platform workspace owner', async () => {
    await new PlatformAdminService(prisma, hasher).ensure({
      name: 'Operator',
      email: 'root@example.com',
      password,
    });
    await organizations().create({
      tenant: { name: 'North', subdomain: 'north' },
      owner: { name: 'Nia', email: 'nia@example.com', password },
    });
    const guard = new PlatformOperatorGuard(prisma);
    const platform = await prisma.tenant.findUniqueOrThrow({ where: { subdomain: PLATFORM_SUBDOMAIN } });
    const north = await prisma.tenant.findUniqueOrThrow({ where: { subdomain: 'north' } });

    await expect(guard.canActivate(asOwner(platform.id))).resolves.toBe(true);
    await expect(guard.canActivate(asOwner(north.id))).rejects.toBeInstanceOf(AuthorizationError);
  });
});

function organizations(): ProvisionOrganizationService {
  return new ProvisionOrganizationService(
    prisma,
    new CreateTenantService(prisma, new OutboxService(), new PlanEntitlementGrant()),
    hasher,
  );
}

function asOwner(tenantId: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        auth: {
          userId: '11111111-1111-4111-8111-111111111111',
          tenantId,
          role: 'OWNER' as const,
          authenticationVersion: 1,
          sessionHash: 'hash',
        },
      }),
    }),
  } as ExecutionContext;
}
