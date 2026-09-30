import { createTestPrismaClient, type PrismaClient } from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthorizationError } from '../auth/authorization';
import { requestContextFromSession, type RequestContext } from '../tenant/request-context';
import { AuditAccessService } from './audit-access.service';
import { AuditEventStore } from './audit-event.store';

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
});

afterAll(async () => {
  await prisma?.$disconnect();
});

beforeEach(async () => {
  await prisma.auditEvent.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('AuditAccessService', () => {
  it('shows a tenant its own audit rows and hides the other tenant', async () => {
    const owner = await createUser('acme', 'OWNER');
    const outsider = await createUser('beta', 'OWNER');
    const events = new AuditEventStore(prisma);
    await events.appendNow(denied(owner));
    const access = new AuditAccessService(events);

    expect(await access.list(contextFor(owner))).toHaveLength(1);
    expect(await access.list(contextFor(outsider, 'ADMIN'))).toHaveLength(0);
    expect(() => access.list(contextFor(owner, 'MEMBER'))).toThrow(AuthorizationError);
  });
});

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

function contextFor(user: { userId: string; tenantId: string }, role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'OWNER'): RequestContext {
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
