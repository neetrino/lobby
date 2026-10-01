import { contactCreatedEventSchema } from '@lobby/contracts';
import {
  createTestPrismaClient,
  disposeTestPrismaClient,
  type PrismaClient,
} from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ModuleEntitlementService } from '../../../common/authorization/module-entitlement';
import { requirePermission } from '../../../common/authorization/require-permission';
import { OutboxService } from '../../../common/outbox/outbox.service';
import { ContactRepository } from '../infrastructure/contact.repository';
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
  await disposeTestPrismaClient(prisma);
});

beforeEach(async () => {
  await prisma.outboxEvent.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenantModule.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('CreateContactService', () => {
  it('lets owner, admin, and member create a contact', async () => {
    const tenant = await createTenant('roles');
    const service = new CreateContactService(
      new ContactRepository(prisma),
      new OutboxService(),
      new ModuleEntitlementService(prisma),
    );

    for (const role of ['OWNER', 'ADMIN', 'MEMBER'] as const) {
      const created = await service.create(tenantContext(tenant.id, role, tenant.userId), {
        name: role,
      });
      expect(created.contact.name).toBe(role);
    }
  });

  it('commits the contact and outbox event together', async () => {
    const tenant = await createTenant('acme');
    const service = new CreateContactService(
      new ContactRepository(prisma),
      new OutboxService(),
      new ModuleEntitlementService(prisma),
    );

    const created = await service.create(tenantContext(tenant.id, 'OWNER', tenant.userId), {
      name: 'Ada',
    });

    const storedContact = await prisma.contact.findUniqueOrThrow({
      where: { id: created.contact.id },
    });
    const storedEvent = await prisma.outboxEvent.findFirstOrThrow({
      where: { aggregateId: created.contact.id },
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
    const service = new CreateContactService(
      new ContactRepository(prisma),
      outbox,
      new ModuleEntitlementService(prisma),
    );

    await expect(
      service.create(tenantContext(tenant.id, 'OWNER', tenant.userId), { name: 'Ada' }),
    ).rejects.toThrow(
      'outbox unavailable',
    );
    expect(await prisma.contact.count()).toBe(0);
    expect(await prisma.outboxEvent.count()).toBe(0);
  });

  it('rolls back when the contact write fails', async () => {
    const service = new CreateContactService(
      new ContactRepository(prisma),
      new OutboxService(),
      new ModuleEntitlementService(prisma),
    );

    await expect(
      service.create(tenantContext('99999999-9999-4999-8999-999999999999'), { name: 'Ada' }),
    ).rejects.toThrow();
    expect(await prisma.outboxEvent.count()).toBe(0);
    expect(await prisma.contact.count()).toBe(0);
  });

  it('does not create a contact when the module is disabled', async () => {
    const tenant = await createTenant('off', 'DISABLED');
    const context = tenantContext(tenant.id, 'MEMBER');
    expect(() => requirePermission(context, 'contacts:create')).not.toThrow();
    const service = new CreateContactService(
      new ContactRepository(prisma),
      new OutboxService(),
      new ModuleEntitlementService(prisma),
    );

    await expect(service.create(context, { name: 'Ada' })).rejects.toMatchObject({
      code: 'MODULE_DISABLED',
    });
    expect(await prisma.contact.count()).toBe(0);
    expect(await prisma.outboxEvent.count()).toBe(0);
  });

  it('rejects an invalid payload before persistence', async () => {
    const tenant = await createTenant('invalid');
    const service = new CreateContactService(
      new ContactRepository(prisma),
      new OutboxService(),
      new ModuleEntitlementService(prisma),
    );

    await expect(service.create(tenantContext(tenant.id), { name: '   ' })).rejects.toThrow();
    expect(await prisma.contact.count()).toBe(0);
    expect(await prisma.outboxEvent.count()).toBe(0);
  });

  it('rejects a client tenant id before writing', async () => {
    const tenant = await createTenant('owner');
    const other = await createTenant('other');
    const service = new CreateContactService(
      new ContactRepository(prisma),
      new OutboxService(),
      new ModuleEntitlementService(prisma),
    );

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

function tenantContext(
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

async function createTenant(subdomain: string, contacts: 'ENABLED' | 'DISABLED' = 'ENABLED') {
  const tenant = await prisma.tenant.create({
    data: { name: subdomain, subdomain, plan: 'STARTER' },
  });
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `${subdomain}@example.com`,
      name: subdomain,
      passwordHash: 'hash',
      role: 'OWNER',
    },
  });
  await prisma.tenantModule.create({
    data: { tenantId: tenant.id, moduleKey: 'contacts', status: contacts },
  });
  return { id: tenant.id, userId: user.id };
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
