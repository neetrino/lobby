import { tenantCreatedEventSchema } from '@lobby/contracts';
import { createTestPrismaClient, type PrismaClient } from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { OutboxService } from '../../../common/outbox/outbox.service';
import { CreateTenantService } from './create-tenant.service';

const foundingUser = { name: 'Ada', email: 'ada@example.com' };

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
});

afterAll(async () => {
  await prisma?.$disconnect();
});

beforeEach(async () => {
  await prisma.outboxEvent.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('CreateTenantService', () => {
  it('commits the tenant, its first user, and the outbox event together', async () => {
    const service = new CreateTenantService(prisma, new OutboxService());

    const created = await service.create({
      name: 'Acme',
      subdomain: 'Acme',
      plan: 'starter',
      user: foundingUser,
    });

    const storedTenant = await prisma.tenant.findUniqueOrThrow({ where: { id: created.tenant.id } });
    const storedUser = await prisma.user.findUniqueOrThrow({ where: { id: created.user.id } });
    const storedEvent = await prisma.outboxEvent.findFirstOrThrow({
      where: { aggregateId: created.tenant.id },
    });
    expect(storedTenant.subdomain).toBe('acme');
    expect(storedUser.tenantId).toBe(storedTenant.id);
    expect(storedUser.email).toBe('ada@example.com');
    expect(storedEvent.eventType).toBe('tenant.created');
    expect(storedEvent.tenantId).toBe(storedTenant.id);
    expect(
      tenantCreatedEventSchema.safeParse(toEvent(storedEvent, storedTenant, storedUser.id)).success,
    ).toBe(true);
  });

  it('allows the same email in a second tenant', async () => {
    const service = new CreateTenantService(prisma, new OutboxService());

    await service.create({ name: 'One', subdomain: 'one', plan: 'starter', user: foundingUser });
    await service.create({ name: 'Two', subdomain: 'two', plan: 'starter', user: foundingUser });

    expect(await prisma.user.count()).toBe(2);
    expect(await prisma.tenant.count()).toBe(2);
  });

  it('rolls back the tenant and user when the outbox insert fails', async () => {
    const outbox = new OutboxService();
    outbox.enqueue = () => Promise.reject(new Error('outbox unavailable'));
    const service = new CreateTenantService(prisma, outbox);

    await expect(
      service.create({ name: 'Acme', subdomain: 'acme', plan: 'starter', user: foundingUser }),
    ).rejects.toThrow('outbox unavailable');
    expect(await prisma.tenant.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.outboxEvent.count()).toBe(0);
  });

  it('rejects an invalid payload before persistence', async () => {
    const service = new CreateTenantService(prisma, new OutboxService());

    await expect(
      service.create({ name: '   ', subdomain: '-bad', plan: 'starter', user: foundingUser }),
    ).rejects.toThrow();
    expect(await prisma.tenant.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.outboxEvent.count()).toBe(0);
  });

  it('does not keep a user when the subdomain is already taken', async () => {
    const service = new CreateTenantService(prisma, new OutboxService());
    await service.create({ name: 'Acme', subdomain: 'acme', plan: 'starter', user: foundingUser });

    await expect(
      service.create({
        name: 'Other',
        subdomain: 'acme',
        plan: 'starter',
        user: { name: 'Grace', email: 'grace@example.com' },
      }),
    ).rejects.toThrow();
    expect(await prisma.tenant.count()).toBe(1);
    expect(await prisma.user.count()).toBe(1);
  });

  it('ignores a client-supplied tenant id', async () => {
    const service = new CreateTenantService(prisma, new OutboxService());
    const suppliedTenantId = '99999999-9999-4999-8999-999999999999';

    const created = await service.create({
      name: 'Acme',
      subdomain: 'acme',
      plan: 'starter',
      user: foundingUser,
      tenantId: suppliedTenantId,
    } as { name: string; subdomain: string; plan: string; user: typeof foundingUser });

    expect(created.tenant.id).not.toBe(suppliedTenantId);
    expect(created.user.tenantId).toBe(created.tenant.id);
  });
});

function toEvent(
  event: {
    id: string;
    tenantId: string;
    eventType: string;
    eventVersion: number;
    aggregateType: string;
    aggregateId: string;
    occurredAt: Date;
  },
  tenant: { name: string; subdomain: string; plan: string },
  userId: string,
) {
  return {
    eventId: event.id,
    eventType: event.eventType,
    eventVersion: event.eventVersion,
    tenantId: event.tenantId,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    occurredAt: event.occurredAt.toISOString(),
    payload: {
      name: tenant.name,
      subdomain: tenant.subdomain,
      plan: tenant.plan,
      userId,
    },
  };
}
