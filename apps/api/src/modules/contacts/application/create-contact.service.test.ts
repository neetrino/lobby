import { contactCreatedEventSchema } from '@lobby/contracts';
import { createTestPrismaClient, type PrismaClient } from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { OutboxService } from '../../../common/outbox/outbox.service';
import {
  requestContextFromSession,
  type RequestContext,
  type UserRole,
} from '../../../common/tenant/request-context';
import { CreateContactService } from './create-contact.service';

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
  await prisma.tenant.deleteMany();
});

describe('CreateContactService', () => {
  it('lets owner, admin, and member create a contact', async () => {
    const tenant = await createTenant('roles');
    const service = new CreateContactService(prisma, new OutboxService());

    for (const role of ['OWNER', 'ADMIN', 'MEMBER'] as const) {
      const contact = await service.create(tenantContext(tenant.id, role), { name: role });
      expect(contact.name).toBe(role);
    }
  });

  it('commits the contact and outbox event together', async () => {
    const tenant = await createTenant('acme');
    const service = new CreateContactService(prisma, new OutboxService());

    const contact = await service.create(tenantContext(tenant.id), { name: 'Ada' });

    const storedContact = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
    const storedEvent = await prisma.outboxEvent.findFirstOrThrow({
      where: { aggregateId: contact.id },
    });
    expect(storedContact.tenantId).toBe(tenant.id);
    expect(storedEvent.tenantId).toBe(tenant.id);
    expect(storedEvent.eventType).toBe('contact.created');
    expect(
      contactCreatedEventSchema.safeParse(toEvent(storedEvent, storedContact.name)).success,
    ).toBe(true);
  });

  it('rolls back both writes when the outbox insert fails', async () => {
    const tenant = await createTenant('rollback');
    const outbox = new OutboxService();
    outbox.enqueue = () => Promise.reject(new Error('outbox unavailable'));
    const service = new CreateContactService(prisma, outbox);

    await expect(service.create(tenantContext(tenant.id), { name: 'Ada' })).rejects.toThrow(
      'outbox unavailable',
    );
    expect(await prisma.contact.count()).toBe(0);
    expect(await prisma.outboxEvent.count()).toBe(0);
  });

  it('rolls back when the contact write fails', async () => {
    const service = new CreateContactService(prisma, new OutboxService());

    await expect(
      service.create(tenantContext('99999999-9999-4999-8999-999999999999'), { name: 'Ada' }),
    ).rejects.toThrow();
    expect(await prisma.outboxEvent.count()).toBe(0);
    expect(await prisma.contact.count()).toBe(0);
  });

  it('rejects an invalid payload before persistence', async () => {
    const tenant = await createTenant('invalid');
    const service = new CreateContactService(prisma, new OutboxService());

    await expect(service.create(tenantContext(tenant.id), { name: '   ' })).rejects.toThrow();
    expect(await prisma.contact.count()).toBe(0);
    expect(await prisma.outboxEvent.count()).toBe(0);
  });

  it('rejects a client tenant id before writing', async () => {
    const tenant = await createTenant('owner');
    const other = await createTenant('other');
    const service = new CreateContactService(prisma, new OutboxService());

    await expect(
      service.create(tenantContext(tenant.id), {
        name: 'Ada',
        tenantId: other.id,
      } as { name: string }),
    ).rejects.toThrow();
    expect(await prisma.contact.count()).toBe(0);
    expect(await prisma.outboxEvent.count()).toBe(0);
  });
});

function tenantContext(tenantId: string, role: UserRole = 'OWNER'): RequestContext {
  return requestContextFromSession(
    {
      tenantId,
      userId: '11111111-1111-4111-8111-111111111111',
      role,
    },
    '44444444-4444-4444-8444-444444444444',
  );
}

async function createTenant(subdomain: string) {
  return prisma.tenant.create({
    data: { name: subdomain, subdomain, plan: 'STARTER' },
  });
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
  },
  name: string,
) {
  return {
    eventId: event.id,
    eventType: event.eventType,
    eventVersion: event.eventVersion,
    tenantId: event.tenantId,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    occurredAt: event.occurredAt.toISOString(),
    payload: { name },
  };
}
