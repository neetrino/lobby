import { randomUUID } from 'node:crypto';
import {
  createTestPrismaClient,
  disposeTestPrismaClient,
  type PrismaClient,
} from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthorizationError } from '../../../common/auth/authorization';
import { clearTestTenantData } from '../../../testing/clear-test-tenant-data';
import { AuditEventStore } from '../../../common/audit/audit-event.store';
import { ModuleEntitlementService } from '../../../common/authorization/module-entitlement';
import { ROLE_PERMISSIONS } from '../../../common/authorization/role-permissions';
import { OutboxService } from '../../../common/outbox/outbox.service';
import {
  requestContextFromSession,
  type RequestContext,
  type UserRole,
} from '../../../common/tenant/request-context';
import { ContactRepository } from '../infrastructure/contact.repository';
import { ContactEmailConflictError } from './contact-email-conflict.error';
import { ContactLifecycleService } from './contact-lifecycle.service';
import { ContactsReadService } from './contacts-read.service';
import { CreateContactService } from './create-contact.service';
import { ContactAccessService } from './contact-access.service';
import { contactListQuerySchema } from './list-contacts.schema';

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

describe('contact lifecycle', () => {
  it('warns on a repeated name and rejects a repeated email', async () => {
    const tenant = await createTenant('acme');
    const service = createService();
    const context = caller(tenant, 'OWNER');
    const first = await service.create(context, { name: 'Ada', email: 'ada@example.com' });
    const second = await service.create(context, { name: 'ada', phone: '555' });

    expect(second.warnings).toEqual([{ code: 'POSSIBLE_DUPLICATE', contactId: first.contact.id }]);
    expect(JSON.stringify(second.warnings)).not.toContain('ada@example.com');
    await expect(
      service.create(context, { name: 'Other', email: 'Ada@Example.com' }),
    ).rejects.toBeInstanceOf(ContactEmailConflictError);
    expect(await prisma.contact.count()).toBe(2);
  });

  it('lists active contacts by name and searches phone without returning email in the cursor', async () => {
    const tenant = await createTenant('list');
    const service = createService();
    const access = accessService();
    const context = caller(tenant, 'MEMBER');
    await service.create(context, { name: 'Bea', phone: '555-0100' });
    await service.create(context, { name: 'Ada', phone: '555-0199' });

    const page = await access.list(
      context,
      contactListQuerySchema.parse({ limit: 1, sort: 'asc' }),
    );
    expect(page.data.map((contact) => contact.name)).toEqual(['Ada']);
    expect(page.page.nextCursor).toEqual(expect.any(String));
    if (page.page.nextCursor === null) {
      throw new Error('Expected a contact cursor');
    }
    const next = await access.list(
      context,
      contactListQuerySchema.parse({ limit: 1, sort: 'asc', cursor: page.page.nextCursor }),
    );
    expect(next.data.map((contact) => contact.name)).toEqual(['Bea']);
    const found = await access.list(
      context,
      contactListQuerySchema.parse({ limit: 50, sort: 'asc', search: '0100' }),
    );
    expect(found.data.map((contact) => contact.name)).toEqual(['Bea']);
  });

  it('lets the owner or an admin archive, hides the row, and audits archive and restore', async () => {
    const tenant = await createTenant('archive');
    const member = await addUser(tenant.id, 'member@example.com', 'MEMBER');
    const stranger = await addUser(tenant.id, 'stranger@example.com', 'MEMBER');
    const created = await createService().create(caller(tenant, 'MEMBER', member.id), {
      name: 'Ada',
      email: 'ada@example.com',
      phone: '+374-000',
    });
    const lifecycle = lifecycleService();
    const access = accessService();
    const ownerContext = caller(tenant, 'MEMBER', member.id);

    await expect(
      lifecycle.archive(caller(tenant, 'MEMBER', stranger.id), created.contact.id),
    ).rejects.toBeInstanceOf(AuthorizationError);
    const archived = await lifecycle.archive(ownerContext, created.contact.id);
    const active = await access.list(ownerContext, contactListQuerySchema.parse({ limit: 50 }));
    const hidden = await access.list(
      ownerContext,
      contactListQuerySchema.parse({ limit: 50, archived: 'true' }),
    );
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { resourceId: created.contact.id },
    });
    const events = await prisma.outboxEvent.findMany({
      where: { aggregateId: created.contact.id },
    });

    expect(archived?.archivedAt).toBeInstanceOf(Date);
    expect(active.data).toHaveLength(0);
    expect(await access.activeCount(ownerContext)).toBe(0);
    expect(hidden.data.map((contact) => contact.id)).toEqual([created.contact.id]);
    expect(await access.read(ownerContext, created.contact.id)).toMatchObject({ name: 'Ada' });
    expect(audit.action).toBe('contact.archived');
    expect(audit.changes).toBeNull();
    expect(events.map((event) => event.eventType)).toEqual(['contact.created']);
    await expect(
      createService().create(ownerContext, { name: 'Copy', email: 'ada@example.com' }),
    ).rejects.toBeInstanceOf(ContactEmailConflictError);

    const restored = await lifecycle.restore(
      caller(tenant, 'ADMIN', tenant.userId),
      created.contact.id,
    );
    const audits = await prisma.auditEvent.findMany({
      where: { resourceId: created.contact.id },
      orderBy: { occurredAt: 'asc' },
    });

    expect(restored?.archivedAt).toBeNull();
    expect(audits.map((row) => row.action)).toEqual(['contact.archived', 'contact.restored']);
    expect(audits.every((row) => row.changes === null)).toBe(true);
    expect(JSON.stringify({ audits, events })).not.toContain('ada@example.com');
    expect(JSON.stringify({ audits, events })).not.toContain('+374-000');
  });

  it('answers exists and summaries for the caller tenant, including an archived contact', async () => {
    const tenant = await createTenant('read');
    const other = await createTenant('other');
    const created = await createService().create(caller(tenant, 'OWNER'), { name: 'Ada' });
    await lifecycleService().archive(caller(tenant, 'OWNER'), created.contact.id);
    const reader = readService();

    expect(await reader.exists(caller(tenant, 'MEMBER'), created.contact.id)).toBe(true);
    expect(await reader.getSummary(caller(other, 'OWNER'), created.contact.id)).toBeNull();
    expect(
      await reader.getSummaries(caller(tenant, 'MEMBER'), [created.contact.id, randomUUID()]),
    ).toEqual(new Map([[created.contact.id, { id: created.contact.id, name: 'Ada' }]]));
    await prisma.tenantModule.update({
      where: { tenantId_moduleKey: { tenantId: tenant.id, moduleKey: 'contacts' } },
      data: { status: 'DISABLED' },
    });
    await expect(reader.exists(caller(tenant, 'OWNER'), created.contact.id)).rejects.toMatchObject({
      code: 'MODULE_DISABLED',
    });
  });

  it('refuses the read door when the caller lacks contacts:read', async () => {
    const tenant = await createTenant('door');
    const created = await createService().create(caller(tenant, 'OWNER'), { name: 'Ada' });
    const reader = readService();
    const member = caller(tenant, 'MEMBER');
    const saved = ROLE_PERMISSIONS.MEMBER;
    ROLE_PERMISSIONS.MEMBER = saved.filter((permission) => permission !== 'contacts:read');
    try {
      await expect(reader.exists(member, created.contact.id)).rejects.toBeInstanceOf(
        AuthorizationError,
      );
      await expect(reader.getSummary(member, created.contact.id)).rejects.toBeInstanceOf(
        AuthorizationError,
      );
      await expect(reader.getSummaries(member, [created.contact.id])).rejects.toBeInstanceOf(
        AuthorizationError,
      );
    } finally {
      ROLE_PERMISSIONS.MEMBER = saved;
    }
  });
});

function createService(): CreateContactService {
  return new CreateContactService(
    new ContactRepository(prisma),
    new OutboxService(),
    new ModuleEntitlementService(prisma),
  );
}

function accessService(): ContactAccessService {
  return new ContactAccessService(
    new ContactRepository(prisma),
    new ModuleEntitlementService(prisma),
  );
}

function lifecycleService(): ContactLifecycleService {
  return new ContactLifecycleService(
    new ContactRepository(prisma),
    new AuditEventStore(prisma),
    new ModuleEntitlementService(prisma),
  );
}

function readService(): ContactsReadService {
  return new ContactsReadService(
    new ContactRepository(prisma),
    new ModuleEntitlementService(prisma),
  );
}

function caller(
  tenant: { id: string; userId: string },
  role: UserRole,
  userId = tenant.userId,
): RequestContext {
  return requestContextFromSession(
    { tenantId: tenant.id, userId, role },
    '44444444-4444-4444-8444-444444444444',
  );
}

async function createTenant(subdomain: string) {
  const tenant = await prisma.tenant.create({
    data: { name: subdomain, subdomain, plan: 'STARTER' },
  });
  const user = await addUser(tenant.id, `${subdomain}@example.com`, 'OWNER');
  await prisma.tenantModule.create({
    data: { tenantId: tenant.id, moduleKey: 'contacts', status: 'ENABLED' },
  });
  return { id: tenant.id, userId: user.id };
}

function addUser(tenantId: string, email: string, role: UserRole) {
  return prisma.user.create({
    data: { tenantId, email, name: email, passwordHash: 'hash', role },
  });
}
