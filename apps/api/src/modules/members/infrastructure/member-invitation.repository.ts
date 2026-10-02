import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import type { InvitableRole } from '../domain/invitation-policy';

export type InvitationRow = {
  id: string;
  tenantId: string;
  email: string;
  role: InvitableRole;
  tokenHash: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  invitedById: string;
};

export type InvitationInsert = {
  tenantId: string;
  email: string;
  role: InvitableRole;
  tokenHash: string;
  expiresAt: Date;
  invitedById: string;
};

export type InvitationListItem = {
  id: string;
  email: string;
  role: InvitableRole;
  expiresAt: Date;
  createdAt: Date;
  invitedByName: string;
};

export type TenantMemberItem = {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
};

type InvitationDb = PrismaClient | Prisma.TransactionClient;

/** Tenant invitation rows. Callers pass the transaction when the write must commit with the outbox. */
@Injectable()
export class MemberInvitationRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(run);
  }

  loadById(id: string): Promise<InvitationRow | null> {
    return this.findById(this.prisma, id);
  }

  findById(db: InvitationDb, id: string): Promise<InvitationRow | null> {
    return db.memberInvitation.findUnique({ where: { id } }).then(toInvitationRow);
  }

  findUnsettledByEmail(
    db: InvitationDb,
    tenantId: string,
    email: string,
  ): Promise<InvitationRow | null> {
    return db.memberInvitation
      .findFirst({
        where: { tenantId, email, acceptedAt: null, revokedAt: null },
      })
      .then(toInvitationRow);
  }

  userEmailExists(db: InvitationDb, tenantId: string, email: string): Promise<boolean> {
    return db.user
      .findFirst({ where: { tenantId, email }, select: { id: true } })
      .then((row) => row !== null);
  }

  createMember(
    db: InvitationDb,
    input: { tenantId: string; email: string; name: string; passwordHash: string },
  ): Promise<{ id: string; authenticationVersion: number }> {
    return db.user.create({
      data: {
        tenantId: input.tenantId,
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
        role: 'MEMBER',
        status: 'ACTIVE',
      },
      select: { id: true, authenticationVersion: true },
    });
  }

  insert(db: InvitationDb, input: InvitationInsert): Promise<InvitationRow> {
    return db.memberInvitation
      .create({
        data: input,
      })
      .then((row) => {
        const stored = toInvitationRow(row);
        if (stored === null) {
          throw new Error('Invitation insert did not return a row.');
        }
        return stored;
      });
  }

  replaceToken(
    db: InvitationDb,
    id: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<number> {
    return db.memberInvitation
      .updateMany({
        where: { id, acceptedAt: null, revokedAt: null },
        data: { tokenHash, expiresAt },
      })
      .then((result) => result.count);
  }

  revoke(db: InvitationDb, id: string, revokedAt: Date): Promise<number> {
    return db.memberInvitation
      .updateMany({
        where: { id, acceptedAt: null, revokedAt: null },
        data: { revokedAt },
      })
      .then((result) => result.count);
  }

  markAccepted(db: InvitationDb, id: string, acceptedAt: Date): Promise<number> {
    return db.memberInvitation
      .updateMany({
        where: { id, acceptedAt: null, revokedAt: null, expiresAt: { gt: acceptedAt } },
        data: { acceptedAt },
      })
      .then((result) => result.count);
  }

  async listPending(tenantId: string, now: Date): Promise<InvitationListItem[]> {
    const rows = await this.prisma.memberInvitation.findMany({
      where: { tenantId, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: { select: { name: true } },
      },
    });
    return rows.flatMap((row) =>
      row.role === 'MEMBER'
        ? [
            {
              id: row.id,
              email: row.email,
              role: 'MEMBER' as const,
              expiresAt: row.expiresAt,
              createdAt: row.createdAt,
              invitedByName: row.invitedBy.name,
            },
          ]
        : [],
    );
  }

  listMembers(tenantId: string): Promise<TenantMemberItem[]> {
    return this.prisma.user.findMany({
      where: { tenantId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  loadTenant(tenantId: string): Promise<{ name: string; subdomain: string } | null> {
    return this.tenantIdentity(this.prisma, tenantId);
  }

  tenantIdentity(
    db: InvitationDb,
    tenantId: string,
  ): Promise<{ name: string; subdomain: string } | null> {
    return db.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, subdomain: true },
    });
  }

  inviterName(db: InvitationDb, userId: string, tenantId: string): Promise<string | null> {
    return db.user
      .findFirst({ where: { id: userId, tenantId }, select: { name: true } })
      .then((row) => row?.name ?? null);
  }
}

function toInvitationRow(
  row: {
    id: string;
    tenantId: string;
    email: string;
    role: string;
    tokenHash: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    revokedAt: Date | null;
    invitedById: string;
  } | null,
): InvitationRow | null {
  if (row === null || row.role !== 'MEMBER') {
    return null;
  }
  return { ...row, role: 'MEMBER' };
}
