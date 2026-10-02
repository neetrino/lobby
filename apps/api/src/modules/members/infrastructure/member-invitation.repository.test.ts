import {
  createTestPrismaClient,
  disposeTestPrismaClient,
  type PrismaClient,
} from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MemberInvitationRepository } from './member-invitation.repository';

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
});

afterAll(async () => {
  await disposeTestPrismaClient(prisma);
});

beforeEach(async () => {
  await prisma.memberInvitation.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('MemberInvitationRepository.markAccepted', () => {
  it('accepts only the token hash that is still stored', async () => {
    const repository = new MemberInvitationRepository(prisma);
    const invitation = await createInvitation('current-hash');
    const now = new Date();

    const stale = await repository.markAccepted(prisma, invitation.id, now, 'replaced-hash');
    const current = await repository.markAccepted(prisma, invitation.id, now, 'current-hash');
    const stored = await prisma.memberInvitation.findUniqueOrThrow({ where: { id: invitation.id } });

    expect(stale).toBe(0);
    expect(current).toBe(1);
    expect(stored.acceptedAt).not.toBeNull();
  });

  it('replaces a token only when the previous hash is still current', async () => {
    const repository = new MemberInvitationRepository(prisma);
    const invitation = await createInvitation('current-hash');
    const expiresAt = new Date(Date.now() + 60_000);
    const lost = await repository.replaceToken(
      prisma,
      invitation.id,
      'older-hash',
      'next-hash',
      expiresAt,
    );
    const replaced = await repository.replaceToken(
      prisma,
      invitation.id,
      'current-hash',
      'next-hash',
      expiresAt,
    );
    const stored = await prisma.memberInvitation.findUniqueOrThrow({ where: { id: invitation.id } });

    expect(lost).toBe(0);
    expect(replaced).toBe(1);
    expect(stored.tokenHash).toBe('next-hash');
  });
});

async function createInvitation(tokenHash: string) {
  const tenant = await prisma.tenant.create({
    data: { name: 'Acme', subdomain: 'accept-hash', plan: 'STARTER' },
  });
  const owner = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'owner@accept-hash.test',
      name: 'Ada',
      passwordHash: 'hash',
      role: 'OWNER',
    },
  });
  return prisma.memberInvitation.create({
    data: {
      tenantId: tenant.id,
      email: 'member@example.com',
      role: 'MEMBER',
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      invitedById: owner.id,
    },
  });
}
