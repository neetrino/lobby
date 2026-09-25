import { createTestPrismaClient, type PrismaClient } from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const passwordHash =
  '$argon2id$v=19$m=65536,p=4,t=3$PEbBsUzxZ+rLvTW4czR4Ww$GiSsH9i7n0l40OGimI/KV+2Gf6GNJvf5MiPpVuIqXb8';

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
});

afterAll(async () => {
  await prisma?.$disconnect();
});

beforeEach(async () => {
  await prisma.outboxEvent.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('tenant database invariants', () => {
  it('rejects a subdomain that bypasses lowercase normalization', async () => {
    await expect(createTenant('Acme')).rejects.toThrow();
    expect(await prisma.tenant.count()).toBe(0);
  });

  it('rejects an uppercase email', async () => {
    const tenant = await createTenant('acme');

    await expect(createOwner(tenant.id, 'Ada@Example.com')).rejects.toThrow();
    expect(await prisma.user.count()).toBe(0);
  });

  it('rejects a user without a tenant', async () => {
    await expect(createOwner('99999999-9999-4999-8999-999999999999', 'ada@example.com')).rejects.toThrow();
    expect(await prisma.user.count()).toBe(0);
  });

  it('has no membership join table', async () => {
    const rows = await prisma.$queryRaw<Array<{ memberships: string | null; userTenants: string | null }>>`
      SELECT to_regclass('public.memberships')::text AS memberships,
             to_regclass('public.user_tenants')::text AS "userTenants"
    `;
    expect(rows[0]?.memberships).toBeNull();
    expect(rows[0]?.userTenants).toBeNull();
  });

  it('rejects a repeated normalized subdomain', async () => {
    await createTenant('acme');

    await expect(createTenant('acme')).rejects.toThrow();
    expect(await prisma.tenant.count()).toBe(1);
  });

  it('rejects a repeated email inside one tenant', async () => {
    const tenant = await createTenant('acme');
    await createOwner(tenant.id, 'ada@example.com');

    await expect(createOwner(tenant.id, 'ada@example.com')).rejects.toThrow();
    expect(await prisma.user.count()).toBe(1);
  });

  it('allows the same email in different tenants', async () => {
    const first = await createTenant('one');
    const second = await createTenant('two');
    await createOwner(first.id, 'ada@example.com');
    await createOwner(second.id, 'ada@example.com');

    expect(await prisma.user.count()).toBe(2);
  });
});

function createTenant(subdomain: string) {
  return prisma.tenant.create({
    data: { name: subdomain, subdomain, plan: 'STARTER' },
  });
}

function createOwner(tenantId: string, email: string) {
  return prisma.user.create({
    data: {
      tenantId,
      email,
      name: 'Ada',
      passwordHash,
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });
}
