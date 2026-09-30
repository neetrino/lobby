import { readFileSync } from 'node:fs';
import { createTestPrismaClient, type PrismaClient } from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthorizationError, scopedTenantId } from '../auth/authorization';
import { mapHttpException } from '../http/map-http-exception';
import { requestContextFromSession } from '../tenant/request-context';
import type { TenantId } from '../tenant/tenant-id';
import { ModuleDisabledError, ModuleEntitlementService } from './module-entitlement';
import { requirePermission } from './require-permission';

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
});

afterAll(async () => {
  await prisma?.$disconnect();
});

beforeEach(async () => {
  await prisma.tenantModule.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('module entitlement', () => {
  it('allows an enabled module', async () => {
    const tenantId = await seedTenant('enabled-a', 'contacts', 'ENABLED');
    const service = new ModuleEntitlementService(prisma);

    expect(await service.isEnabled(tenantId, 'contacts')).toBe(true);
    await expect(service.requireEnabled(tenantId, 'contacts')).resolves.toBeUndefined();
  });

  it('rejects a disabled module with MODULE_DISABLED', async () => {
    const tenantId = await seedTenant('disabled-a', 'contacts', 'DISABLED');
    const service = new ModuleEntitlementService(prisma);

    expect(await service.isEnabled(tenantId, 'contacts')).toBe(false);
    await expect(service.requireEnabled(tenantId, 'contacts')).rejects.toBeInstanceOf(ModuleDisabledError);
    await expect(service.requireEnabled(tenantId, 'contacts')).rejects.toMatchObject({
      code: 'MODULE_DISABLED',
    });
  });

  it('rejects a missing entitlement row', async () => {
    const tenantId = await seedTenant('missing-a');
    const service = new ModuleEntitlementService(prisma);

    expect(await service.isEnabled(tenantId, 'contacts')).toBe(false);
    await expect(service.requireEnabled(tenantId, 'contacts')).rejects.toMatchObject({
      code: 'MODULE_DISABLED',
    });
  });

  it('keeps the same module enabled for one tenant and disabled for another', async () => {
    const enabled = await seedTenant('tenant-on', 'contacts', 'ENABLED');
    const disabled = await seedTenant('tenant-off', 'contacts', 'DISABLED');
    const service = new ModuleEntitlementService(prisma);

    expect(await service.isEnabled(enabled, 'contacts')).toBe(true);
    expect(await service.isEnabled(disabled, 'contacts')).toBe(false);
  });

  it('queries by tenant and module together', async () => {
    const source = readFileSync(new URL('./module-entitlement.ts', import.meta.url), 'utf8');
    expect(source).toContain('tenantId_moduleKey');
    expect(source).not.toContain('findMany');

    const owner = await seedTenant('query-owner');
    await seedTenant('query-other', 'deals', 'ENABLED');
    const service = new ModuleEntitlementService(prisma);

    expect(await service.isEnabled(owner, 'deals')).toBe(false);
    expect(await service.isEnabled(owner, 'messenger')).toBe(false);

    const isolated = await seedTenant('isolated-owner');
    await seedTenant('isolated-other', 'contacts', 'ENABLED');
    expect(await service.isEnabled(isolated, 'contacts')).toBe(false);
  });

  it('does not let a granted permission bypass a disabled module when the module is checked first', async () => {
    const tenantId = await seedTenant('perm-off', 'contacts', 'DISABLED');
    const context = requestContextFromSession(
      { tenantId, userId: '11111111-1111-4111-8111-111111111111', role: 'OWNER' },
      '55555555-5555-4555-8555-555555555555',
    );
    expect(() => requirePermission(context, 'contacts:create')).not.toThrow();

    const createSource = readFileSync(
      new URL('../../modules/contacts/application/create-contact.service.ts', import.meta.url),
      'utf8',
    );
    const createBody = createSource.slice(createSource.indexOf('async create('));
    const moduleAt = createBody.indexOf('requireEnabled(');
    const permissionAt = createBody.indexOf("requirePermission(context, 'contacts:create')");
    expect(moduleAt).toBeGreaterThan(-1);
    expect(permissionAt).toBeGreaterThan(moduleAt);

    const accessSource = readFileSync(
      new URL('../../modules/contacts/application/contact-access.service.ts', import.meta.url),
      'utf8',
    );
    const accessBody = accessSource.slice(accessSource.indexOf('async read('));
    const calls = [...accessBody.matchAll(/requireEnabled\(|requirePermission\(/g)].map((match) => match[0]);
    expect(calls).toEqual([
      'requireEnabled(',
      'requirePermission(',
      'requireEnabled(',
      'requirePermission(',
    ]);

    const service = new ModuleEntitlementService(prisma);
    await expect(service.requireEnabled(scopedTenantId(context), 'contacts')).rejects.toMatchObject({
      code: 'MODULE_DISABLED',
    });
  });

  it('maps MODULE_DISABLED separately from FORBIDDEN', () => {
    const disabled = mapHttpException(new ModuleDisabledError(), 'req-1');
    const forbidden = mapHttpException(new AuthorizationError(), 'req-1');

    expect(disabled).toEqual({
      statusCode: 403,
      body: {
        error: {
          code: 'MODULE_DISABLED',
          message: 'This module is not enabled.',
          requestId: 'req-1',
        },
      },
    });
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
    expect(disabled.body.error.message).not.toContain('contacts');
  });
});

async function seedTenant(
  subdomain: string,
  moduleKey?: 'contacts' | 'deals',
  status?: 'ENABLED' | 'DISABLED',
): Promise<TenantId> {
  const tenant = await prisma.tenant.create({
    data: { name: subdomain, subdomain, plan: 'STARTER' },
  });
  if (moduleKey !== undefined && status !== undefined) {
    await prisma.tenantModule.create({
      data: { tenantId: tenant.id, moduleKey, status },
    });
  }
  return scopedTenantId(
    requestContextFromSession(
      { tenantId: tenant.id, userId: '11111111-1111-4111-8111-111111111111', role: 'MEMBER' },
      '55555555-5555-4555-8555-555555555555',
    ),
  );
}
