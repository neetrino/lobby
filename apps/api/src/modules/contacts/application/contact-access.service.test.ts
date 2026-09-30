import { createTestPrismaClient, type PrismaClient } from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ModuleEntitlementService } from '../../../common/authorization/module-entitlement';
import { ContactRepository } from '../infrastructure/contact.repository';
import {
  requestContextFromSession,
  type RequestContext,
  type UserRole,
} from '../../../common/tenant/request-context';
import { ContactAccessService } from './contact-access.service';

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
});

afterAll(async () => {
  await prisma?.$disconnect();
});

beforeEach(async () => {
  await prisma.contact.deleteMany();
  await prisma.tenantModule.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('ContactAccessService', () => {
  it('lets owner, admin, and member read and rename a contact in their tenant', async () => {
    const tenant = await createTenant('roles');
    const contact = await prisma.contact.create({
      data: { tenantId: tenant.id, name: 'Ada ledger' },
    });
    const service = new ContactAccessService(new ContactRepository(prisma), new ModuleEntitlementService(prisma));

    for (const role of ['OWNER', 'ADMIN', 'MEMBER'] as const) {
      expect((await service.read(requestContext(tenant.id, role), contact.id))?.id).toBe(contact.id);
      const renamed = await service.rename(requestContext(tenant.id, role), contact.id, { name: role });
      expect(renamed?.name).toBe(role);
    }
  });

  it('lets another user in the same tenant read and rename the contact', async () => {
    const tenant = await createTenant('shared');
    const contact = await prisma.contact.create({
      data: { tenantId: tenant.id, name: 'Ada ledger' },
    });
    const service = new ContactAccessService(new ContactRepository(prisma), new ModuleEntitlementService(prisma));
    const colleague = requestContext(tenant.id, 'MEMBER', '22222222-2222-4222-8222-222222222222');

    const read = await service.read(colleague, contact.id);
    const renamed = await service.rename(colleague, contact.id, { name: 'Shared' });

    expect(read).toEqual({ id: contact.id, tenantId: tenant.id, name: 'Ada ledger' });
    expect(renamed).toEqual({ id: contact.id, tenantId: tenant.id, name: 'Shared' });
  });

  it('does not read or rename a contact owned by another tenant', async () => {
    const owner = await createTenant('acme');
    const other = await createTenant('beta');
    const foreign = await prisma.contact.create({
      data: { tenantId: other.id, name: 'Beta ledger' },
    });
    const service = new ContactAccessService(new ContactRepository(prisma), new ModuleEntitlementService(prisma));
    const caller = requestContext(owner.id);

    const read = await service.read(caller, foreign.id);
    const renamed = await service.rename(caller, foreign.id, { name: 'Stolen' });
    const stored = await prisma.contact.findUniqueOrThrow({ where: { id: foreign.id } });

    expect(read).toBeNull();
    expect(renamed).toBeNull();
    expect(stored.name).toBe('Beta ledger');
    expect(stored.tenantId).toBe(other.id);
  });

  it('renames inside the authenticated tenant', async () => {
    const owner = await createTenant('acme');
    const contact = await prisma.contact.create({
      data: { tenantId: owner.id, name: 'Ada ledger' },
    });
    const service = new ContactAccessService(new ContactRepository(prisma), new ModuleEntitlementService(prisma));

    const renamed = await service.rename(requestContext(owner.id), contact.id, {
      name: 'Ada updated',
    });

    expect(renamed).toEqual({ id: contact.id, tenantId: owner.id, name: 'Ada updated' });
  });

  it('rejects a client tenant id and leaves the contact unchanged', async () => {
    const owner = await createTenant('acme');
    const other = await createTenant('beta');
    const contact = await prisma.contact.create({
      data: { tenantId: owner.id, name: 'Ada ledger' },
    });
    const service = new ContactAccessService(new ContactRepository(prisma), new ModuleEntitlementService(prisma));

    await expect(
      service.rename(requestContext(owner.id), contact.id, {
        name: 'Ada updated',
        tenantId: other.id,
      } as { name: string }),
    ).rejects.toThrow();
    const stored = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(stored.name).toBe('Ada ledger');
    expect(stored.tenantId).toBe(owner.id);
  });
});

function requestContext(
  tenantId: string,
  role: UserRole = 'OWNER',
  userId = '11111111-1111-4111-8111-111111111111',
): RequestContext {
  return requestContextFromSession(
    {
      tenantId,
      userId,
      role,
    },
    '44444444-4444-4444-8444-444444444444',
  );
}

async function createTenant(subdomain: string) {
  const tenant = await prisma.tenant.create({
    data: { name: subdomain, subdomain, plan: 'STARTER' },
  });
  await prisma.tenantModule.create({
    data: { tenantId: tenant.id, moduleKey: 'contacts', status: 'ENABLED' },
  });
  return tenant;
}
