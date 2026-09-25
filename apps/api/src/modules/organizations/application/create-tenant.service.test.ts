import { TENANT_CREATED_EVENT_VERSION, tenantCreatedEventSchema } from '@lobby/contracts';
import { createTestPrismaClient, type PrismaClient } from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { OutboxService } from '../../../common/outbox/outbox.service';
import { CreateTenantService } from './create-tenant.service';

const passwordHash =
  '$argon2id$v=19$m=65536,p=4,t=3$PEbBsUzxZ+rLvTW4czR4Ww$GiSsH9i7n0l40OGimI/KV+2Gf6GNJvf5MiPpVuIqXb8';
const owner = { name: 'Ada', email: 'Ada@Example.com', passwordHash };

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
  it('commits the tenant, the owner, and the outbox event together', async () => {
    const service = new CreateTenantService(prisma, new OutboxService());

    const created = await service.createWithOwner({
      tenant: { name: 'Acme', subdomain: 'Acme', plan: 'starter' },
      owner,
    });

    const storedTenant = await prisma.tenant.findUniqueOrThrow({ where: { id: created.tenant.id } });
    const storedUser = await prisma.user.findUniqueOrThrow({ where: { id: created.user.id } });
    const storedEvent = await prisma.outboxEvent.findFirstOrThrow({
      where: { aggregateId: created.tenant.id },
    });
    expect(storedTenant.subdomain).toBe('acme');
    expect(storedTenant.plan).toBe('STARTER');
    expect(storedUser.tenantId).toBe(storedTenant.id);
    expect(storedUser.email).toBe('ada@example.com');
    expect(storedUser.role).toBe('OWNER');
    expect(storedUser.status).toBe('ACTIVE');
    expect(storedUser.authenticationVersion).toBe(1);
    expect(storedUser.passwordHash).toBe(passwordHash);
    expect(storedEvent.eventType).toBe('tenant.created');
    expect(storedEvent.eventVersion).toBe(TENANT_CREATED_EVENT_VERSION);
    expect(storedEvent.tenantId).toBe(storedTenant.id);
    const parsed = tenantCreatedEventSchema.parse(toEvent(storedEvent, storedTenant, storedUser.id));
    expect(parsed.payload.ownerUserId).toBe(storedUser.id);
    expect(JSON.stringify(storedEvent.payload)).not.toContain('password');
  });

  it('allows the same email in a second tenant', async () => {
    const service = new CreateTenantService(prisma, new OutboxService());

    await service.createWithOwner({ tenant: { name: 'One', subdomain: 'one', plan: 'starter' }, owner });
    await service.createWithOwner({ tenant: { name: 'Two', subdomain: 'two', plan: 'starter' }, owner });

    expect(await prisma.user.count()).toBe(2);
    expect(await prisma.tenant.count()).toBe(2);
  });

  it('rolls back the tenant and owner when the outbox insert fails', async () => {
    const outbox = new OutboxService();
    outbox.enqueue = () => Promise.reject(new Error('outbox unavailable'));
    const service = new CreateTenantService(prisma, outbox);

    await expect(service.createWithOwner(command('acme'))).rejects.toThrow('outbox unavailable');
    expect(await prisma.tenant.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.outboxEvent.count()).toBe(0);
  });

  it('rejects an invalid subdomain before persistence', async () => {
    const service = new CreateTenantService(prisma, new OutboxService());

    await expect(
      service.createWithOwner({
        tenant: { name: 'Acme', subdomain: '-bad', plan: 'starter' },
        owner,
      }),
    ).rejects.toThrow();
    expect(await prisma.tenant.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);
  });

  it('rejects an unsupported plan before persistence', async () => {
    const service = new CreateTenantService(prisma, new OutboxService());

    await expect(
      service.createWithOwner({
        tenant: { name: 'Acme', subdomain: 'acme', plan: 'professional' },
        owner,
      } as Parameters<CreateTenantService['createWithOwner']>[0]),
    ).rejects.toThrow();
    expect(await prisma.tenant.count()).toBe(0);
  });

  it('rejects client-supplied tenant id, role, and status', async () => {
    const service = new CreateTenantService(prisma, new OutboxService());
    const suppliedTenantId = '99999999-9999-4999-8999-999999999999';

    await expect(
      service.createWithOwner({
        tenant: { name: 'Acme', subdomain: 'acme', plan: 'starter', tenantId: suppliedTenantId },
        owner: { ...owner, role: 'ADMIN', status: 'DISABLED' },
      } as Parameters<CreateTenantService['createWithOwner']>[0]),
    ).rejects.toThrow();
    expect(await prisma.tenant.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);
  });

  it('does not keep an owner when the subdomain is already taken', async () => {
    const service = new CreateTenantService(prisma, new OutboxService());
    await service.createWithOwner(command('acme'));

    await expect(
      service.createWithOwner({
        tenant: { name: 'Other', subdomain: 'acme', plan: 'starter' },
        owner: { name: 'Grace', email: 'grace@example.com', passwordHash },
      }),
    ).rejects.toThrow();
    expect(await prisma.tenant.count()).toBe(1);
    expect(await prisma.user.count()).toBe(1);
  });
});

function command(subdomain: string) {
  return {
    tenant: { name: subdomain, subdomain, plan: 'starter' as const },
    owner,
  };
}

function toEvent(
  event: {
    id: string;
    tenantId: string;
    eventType: string;
    eventVersion: number;
    aggregateType: string;
    aggregateId: string;
    occurredAt: Date;
    payload: unknown;
  },
  tenant: { name: string; subdomain: string },
  ownerUserId: string,
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
      plan: 'starter',
      ownerUserId,
    },
  };
}
