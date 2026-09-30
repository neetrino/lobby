import { readFileSync } from 'node:fs';
import { createTestPrismaClient, type PrismaClient } from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { requestContextFromSession, type RequestContext } from '../../../common/tenant/request-context';
import { ContactRepository } from './contact.repository';

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

describe('ContactRepository', () => {
  it('keeps a contact inside the tenant that opened the repository', async () => {
    const owner = await createTenant('owner');
    const other = await createTenant('other');
    const repository = new ContactRepository(prisma);
    const created = await repository.forTenant(requestContext(owner.id)).create('Ada');

    const foreign = repository.forTenant(requestContext(other.id));
    expect(await foreign.findById(created.id)).toBeNull();
    expect(await foreign.rename(created.id, 'Stolen')).toBe(0);

    const stored = await repository.forTenant(requestContext(owner.id)).findById(created.id);
    expect(stored).toMatchObject({ id: created.id, tenantId: owner.id, name: 'Ada' });
  });

  it('does not let contact services query the contact table directly', () => {
    const repository = readFileSync(new URL('./contact.repository.ts', import.meta.url), 'utf8');
    const createService = readFileSync(new URL('../application/create-contact.service.ts', import.meta.url), 'utf8');
    const accessService = readFileSync(new URL('../application/contact-access.service.ts', import.meta.url), 'utf8');

    expect(repository.match(/tenantId: this\.tenantId/g)).toHaveLength(3);
    expect(createService).not.toContain('.contact.');
    expect(accessService).not.toContain('.contact.');
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
