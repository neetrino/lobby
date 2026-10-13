import { readFileSync } from 'node:fs';
import {
  createTestPrismaClient,
  disposeTestPrismaClient,
  type PrismaClient,
} from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthorizationError, scopedTenantId } from '../auth/authorization';
import { clearTestTenantData } from '../../testing/clear-test-tenant-data';
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
  await disposeTestPrismaClient(prisma);
});

beforeEach(async () => {
  await clearTestTenantData(prisma);
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
    await expect(service.requireEnabled(tenantId, 'contacts')).rejects.toBeInstanceOf(
      ModuleDisabledError,
    );
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
    expect(publicMethodNames(createSource)).toEqual(['create']);
    expectEnabledBeforePermission(createSource, 'create', 'contacts:create');

    const accessSource = readFileSync(
      new URL('../../modules/contacts/application/contact-access.service.ts', import.meta.url),
      'utf8',
    );
    const accessPermissions: Record<string, string> = {
      activeCount: 'contacts:read',
      read: 'contacts:read',
      list: 'contacts:read',
      update: 'contacts:update',
    };
    expect(publicMethodNames(accessSource).sort()).toEqual(Object.keys(accessPermissions).sort());
    for (const method of publicMethodNames(accessSource)) {
      expectEnabledBeforePermission(accessSource, method, permissionFor(accessPermissions, method));
    }

    const lifecycleSource = readFileSync(
      new URL('../../modules/contacts/application/contact-lifecycle.service.ts', import.meta.url),
      'utf8',
    );
    expect(publicMethodNames(lifecycleSource).sort()).toEqual(['archive', 'restore']);
    for (const method of publicMethodNames(lifecycleSource)) {
      const body = methodBody(lifecycleSource, method);
      expect(body).toContain('this.changeArchive(');
      expect(body).not.toContain('requireEnabled(');
      expect(body).not.toContain('requirePermission(');
    }
    expectEnabledBeforePermission(lifecycleSource, 'changeArchive', 'contacts:update');

    const readSource = readFileSync(
      new URL('../../modules/contacts/application/contacts-read.service.ts', import.meta.url),
      'utf8',
    );
    expect(methodBody(readSource, 'exists')).toContain('this.getSummary(');
    for (const method of ['getSummary', 'getSummaries'] as const) {
      const body = methodBody(readSource, method);
      expect(body.indexOf('this.authorize('), method).toBeGreaterThan(-1);
      expect(body.indexOf('.forTenant('), method).toBeGreaterThan(body.indexOf('this.authorize('));
    }
    expectEnabledBeforePermission(readSource, 'authorize', 'contacts:read');

    const service = new ModuleEntitlementService(prisma);
    await expect(service.requireEnabled(scopedTenantId(context), 'contacts')).rejects.toMatchObject(
      {
        code: 'MODULE_DISABLED',
      },
    );
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

/** Class methods that callers can invoke. Nested helpers and private methods stay out. */
function publicMethodNames(source: string): string[] {
  return [...source.matchAll(/\n  (?!private |constructor)(?:async )?([A-Za-z0-9_]+)\(/g)].map(
    (match) => match[1] ?? '',
  );
}

/**
 * One operation checks the module, then the permission.
 * The pair is read from that method only, so a new operation does not change the others.
 */
function expectEnabledBeforePermission(
  source: string,
  methodName: string,
  permission: string,
): void {
  const calls = [
    ...methodBody(source, methodName).matchAll(/requireEnabled\(|requirePermission\([^)]*\)/g),
  ].map((match) => match[0]);
  expect(calls, methodName).toEqual([
    'requireEnabled(',
    `requirePermission(context, '${permission}')`,
  ]);
}

function methodBody(source: string, methodName: string): string {
  const signature = new RegExp(`\\n  (?:private )?async ${methodName}\\(|\\n  ${methodName}\\(`);
  const start = source.search(signature);
  expect(start, methodName).toBeGreaterThan(-1);
  const fromMethod = source.slice(start + 1);
  const lineBreak = fromMethod.indexOf('\n');
  const nextBoundary = fromMethod
    .slice(lineBreak + 1)
    .search(/\n(?:  (?:async |private |[A-Za-z])|async function)/);
  const end = nextBoundary === -1 ? source.length : start + 1 + lineBreak + 1 + nextBoundary;
  return source.slice(start, end);
}

function permissionFor(permissions: Record<string, string>, method: string): string {
  const permission = permissions[method];
  if (permission === undefined) {
    throw new Error(`Missing permission order for ${method}`);
  }
  return permission;
}

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
