import {
  createTestPrismaClient,
  disposeTestPrismaClient,
  type PrismaClient,
} from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuditEventStore } from '../../../common/audit/audit-event.store';
import { OutboxService } from '../../../common/outbox/outbox.service';
import { requestContextFromSession } from '../../../common/tenant/request-context';
import { MemberInvitationRepository } from '../infrastructure/member-invitation.repository';
import { InviteMemberService } from './invite-member.service';

const tokenKey = Buffer.alloc(32, 7);

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
});

afterAll(async () => {
  await disposeTestPrismaClient(prisma);
});

beforeEach(async () => {
  await prisma.auditEvent.deleteMany();
  await prisma.outboxEvent.deleteMany();
  await prisma.memberInvitation.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenantModule.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('InviteMemberService', () => {
  it('rolls back the invitation when the outbox insert fails', async () => {
    const tenant = await createOwner('rollback');
    const outbox = new OutboxService();
    outbox.enqueue = () => Promise.reject(new Error('outbox unavailable'));
    const service = new InviteMemberService(
      new MemberInvitationRepository(prisma),
      outbox,
      new AuditEventStore(prisma),
      tokenKey,
    );

    await expect(
      service.invite(ownerContext(tenant), inviteInput(), { ipHash: null, userAgent: null }),
    ).rejects.toThrow('outbox unavailable');
    expect(await prisma.memberInvitation.count()).toBe(0);
    expect(await prisma.outboxEvent.count()).toBe(0);
    expect(await prisma.auditEvent.count()).toBe(0);
  });
});

function inviteInput() {
  return { email: 'member@example.com', role: 'MEMBER' as const, locale: 'hy' as const };
}

function ownerContext(tenant: { id: string; userId: string }) {
  return requestContextFromSession(
    { tenantId: tenant.id, userId: tenant.userId, role: 'OWNER' },
    '44444444-4444-4444-8444-444444444444',
  );
}

async function createOwner(subdomain: string) {
  const tenant = await prisma.tenant.create({
    data: { name: subdomain, subdomain, plan: 'STARTER' },
  });
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `owner@${subdomain}.test`,
      name: 'Ada',
      passwordHash: 'hash',
      role: 'OWNER',
    },
  });
  return { id: tenant.id, userId: user.id };
}
