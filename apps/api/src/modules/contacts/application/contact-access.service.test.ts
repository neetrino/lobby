import { createTestPrismaClient, type PrismaClient } from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { requestContextFromSession, type RequestContext } from '../../../common/tenant/request-context';
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
  await prisma.tenant.deleteMany();
});

describe('ContactAccessService', () => {
  it('does not read or rename a contact owned by another tenant', async () => {
    const owner = await createTenant('acme');
    const other = await createTenant('beta');
    const foreign = await prisma.contact.create({
      data: { tenantId: other.id, name: 'Beta ledger' },
    });
    const service = new ContactAccessService(prisma);
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
    const service = new ContactAccessService(prisma);

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
    const service = new ContactAccessService(prisma);

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

function requestContext(tenantId: string): RequestContext {
  return requestContextFromSession(
    {
      tenantId,
      userId: '11111111-1111-4111-8111-111111111111',
      role: 'OWNER',
    },
    '44444444-4444-4444-8444-444444444444',
  );
}

async function createTenant(subdomain: string) {
  return prisma.tenant.create({
    data: { name: subdomain, subdomain, plan: 'STARTER' },
  });
}
