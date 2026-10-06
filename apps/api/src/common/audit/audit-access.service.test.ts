import {
  createTestPrismaClient,
  disposeTestPrismaClient,
  type PrismaClient,
} from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthorizationError } from '../auth/authorization';
import { clearTestTenantData } from '../../testing/clear-test-tenant-data';
import { requestContextFromSession, type RequestContext } from '../tenant/request-context';
import { AuditAccessService } from './audit-access.service';
import { AuditEventStore } from './audit-event.store';
import { auditEventListQuerySchema } from './list-audit-events.schema';

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

describe.sequential('AuditAccessService', () => {
  it('pages audit rows with an index that includes the id tie-breaker', async () => {
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'audit_events'
        AND indexname IN (
          'audit_events_tenant_id_occurred_at_id_idx',
          'audit_events_tenant_id_occurred_at_idx'
        )
    `;

    expect(indexes.map((row) => row.indexname).sort()).toEqual([
      'audit_events_tenant_id_occurred_at_id_idx',
    ]);
  });

  it('shows a tenant its own audit rows and hides the other tenant', async () => {
    const owner = await createUser('acme', 'OWNER');
    const outsider = await createUser('beta', 'OWNER');
    const events = new AuditEventStore(prisma);
    await events.appendNow(denied(owner));
    const access = new AuditAccessService(events);

    expect((await access.list(contextFor(owner), pageQuery())).data).toHaveLength(1);
    expect((await access.list(contextFor(outsider, 'ADMIN'), pageQuery())).data).toHaveLength(0);
    expect(() => access.list(contextFor(owner, 'MEMBER'), pageQuery())).toThrow(AuthorizationError);
  });

  it('pages by occurredAt and id and keeps the next page on the same tenant', async () => {
    const owner = await createUser('acme', 'OWNER');
    const outsider = await createUser('beta', 'OWNER');
    const access = new AuditAccessService(new AuditEventStore(prisma));
    await insertEvent(owner, '10000000-0000-4000-8000-000000000001', '2026-01-01T00:00:00.000Z');
    await insertEvent(owner, '20000000-0000-4000-8000-000000000002', '2026-01-02T00:00:00.000Z');
    await insertEvent(
      owner,
      '30000000-0000-4000-8000-000000000002',
      '2026-01-02T00:00:00.000Z',
      'SUCCESS',
    );
    await insertEvent(outsider, '40000000-0000-4000-8000-000000000004', '2026-01-04T00:00:00.000Z');
    const first = await access.list(contextFor(owner), pageQuery({ limit: '2' }));
    const second = await access.list(
      contextFor(owner),
      pageQuery({ limit: '2', cursor: first.page.nextCursor ?? undefined }),
    );

    expect(first.data.map((row) => row.id)).toEqual([
      '30000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000002',
    ]);
    expect(second.data.map((row) => row.id)).toEqual(['10000000-0000-4000-8000-000000000001']);
    expect(second.page.nextCursor).toBeNull();
    expect(first.data.every((row) => row.tenantId === owner.tenantId)).toBe(true);
  });

  it('filters the allowlisted fields inside the tenant', async () => {
    const owner = await createUser('acme', 'OWNER');
    const other = await createUser('beta', 'OWNER');
    const access = new AuditAccessService(new AuditEventStore(prisma));
    await insertEvent(
      owner,
      '10000000-0000-4000-8000-000000000011',
      '2026-01-01T00:00:00.000Z',
      'DENIED',
      'user.disabled',
    );
    await insertEvent(
      owner,
      '20000000-0000-4000-8000-000000000012',
      '2026-01-02T00:00:00.000Z',
      'SUCCESS',
    );
    await insertEvent(
      other,
      '30000000-0000-4000-8000-000000000013',
      '2026-01-02T00:00:00.000Z',
      'SUCCESS',
    );
    const filtered = await access.list(
      contextFor(owner),
      pageQuery({
        action: 'user.sessions.terminated',
        outcome: 'SUCCESS',
        actorUserId: owner.userId,
        resourceType: 'user',
        resourceId: owner.userId,
        from: '2026-01-02T00:00:00.000Z',
        to: '2026-01-02T00:00:00.000Z',
      }),
    );

    expect(filtered.data.map((row) => row.id)).toEqual(['20000000-0000-4000-8000-000000000012']);
    expect(filtered.page.nextCursor).toBeNull();
  });
});

function pageQuery(input: Record<string, string | undefined> = {}) {
  return auditEventListQuerySchema.parse(input);
}

async function insertEvent(
  user: { userId: string; tenantId: string },
  id: string,
  occurredAt: string,
  outcome: 'SUCCESS' | 'DENIED' = 'DENIED',
  action = 'user.sessions.terminated',
) {
  await prisma.auditEvent.create({
    data: {
      id,
      tenantId: user.tenantId,
      occurredAt: new Date(occurredAt),
      actorUserId: user.userId,
      actorRole: 'OWNER',
      actorType: 'USER',
      action,
      resourceType: 'user',
      resourceId: user.userId,
      outcome,
      requestId: '44444444-4444-4444-8444-444444444444',
      schemaVersion: 1,
    },
  });
}

function denied(user: { userId: string; tenantId: string }) {
  return {
    tenantId: user.tenantId,
    actorUserId: user.userId,
    actorRole: 'OWNER' as const,
    actorType: 'USER' as const,
    action: 'user.sessions.terminated' as const,
    resourceType: 'user' as const,
    resourceId: user.userId,
    outcome: 'DENIED' as const,
    changes: null,
    reason: null,
    requestId: '44444444-4444-4444-8444-444444444444',
    ipHash: null,
    userAgent: null,
  };
}

function contextFor(
  user: { userId: string; tenantId: string },
  role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'OWNER',
): RequestContext {
  return requestContextFromSession(
    { userId: user.userId, tenantId: user.tenantId, role },
    '44444444-4444-4444-8444-444444444444',
  );
}

async function createUser(subdomain: string, role: 'OWNER') {
  const tenant = await prisma.tenant.create({
    data: { name: subdomain, subdomain, plan: 'STARTER' },
  });
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: subdomain,
      email: `${role.toLowerCase()}@${subdomain}.test`,
      passwordHash: 'hash',
      status: 'ACTIVE',
      role,
      authenticationVersion: 1,
    },
  });
  return { userId: user.id, tenantId: tenant.id };
}
