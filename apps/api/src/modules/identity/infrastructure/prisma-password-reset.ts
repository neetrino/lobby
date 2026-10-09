import { Inject, Injectable } from '@nestjs/common';
import type { Locale } from '@lobby/contracts';
import type { Prisma, PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { AuditEventStore } from '../../../common/audit/audit-event.store';
import { OutboxService } from '../../../common/outbox/outbox.service';
import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import { tenantRoles, type TenantRole } from '../../../common/tenant/authenticated-tenant-context';
import type { AuditClient } from '../application/terminate-user-sessions.service';
import { passwordResetRequestedEvent } from '../application/password-reset-events';

export type IssuePasswordReset = {
  tenantId: string;
  userId: string;
  email: string;
  organizationName: string;
  locale: Locale;
  tokenHash: string;
  tokenCiphertext: string;
  expiresAt: Date;
  now: Date;
};

export type ConsumePasswordReset = {
  tokenHash: string;
  passwordHash: string;
  now: Date;
  requestId: string;
  client: AuditClient;
};

type OpenReset = { id: string; tenantId: string; userId: string };

type ResetUser = OpenReset & { role: TenantRole };

@Injectable()
export class PrismaPasswordResetStore {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    private readonly outbox: OutboxService,
    private readonly audit: AuditEventStore,
  ) {}

  /** Replaces any open token for the user and queues the email in one transaction. */
  async issue(input: IssuePasswordReset): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordReset.updateMany({
        where: { tenantId: input.tenantId, userId: input.userId, usedAt: null },
        data: { usedAt: input.now },
      });
      const created = await tx.passwordReset.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
        },
        select: { id: true },
      });
      await this.outbox.enqueue(tx, passwordResetRequestedEvent(delivery(input, created.id)));
    });
  }

  /**
   * Applies the new password when the token is open and the user is active.
   * Returns the user id after the version bump. A bad token returns null.
   */
  async consume(input: ConsumePasswordReset): Promise<{ userId: string } | null> {
    return this.prisma.$transaction(async (tx) => {
      const reset = await this.findOpen(tx, input.tokenHash, input.now);
      const user = reset === null ? null : await this.loadActiveUser(tx, reset);
      if (reset === null || user === null) {
        return null;
      }
      const applied = await this.apply(tx, reset, user, input);
      return applied ? { userId: user.userId } : null;
    });
  }

  private async findOpen(
    tx: Prisma.TransactionClient,
    tokenHash: string,
    now: Date,
  ): Promise<OpenReset | null> {
    const row = await tx.passwordReset.findUnique({
      where: { tokenHash },
      select: { id: true, tenantId: true, userId: true, expiresAt: true, usedAt: true },
    });
    if (row === null || row.usedAt !== null || row.expiresAt.getTime() <= now.getTime()) {
      return null;
    }
    return { id: row.id, tenantId: row.tenantId, userId: row.userId };
  }

  private async loadActiveUser(
    tx: Prisma.TransactionClient,
    reset: OpenReset,
  ): Promise<ResetUser | null> {
    const user = await tx.user.findUnique({
      where: { id_tenantId: { id: reset.userId, tenantId: reset.tenantId } },
      select: { status: true, role: true },
    });
    const role = tenantRoles.find((value) => value === user?.role);
    if (user === null || user.status !== 'ACTIVE' || role === undefined) {
      return null;
    }
    return { ...reset, role };
  }

  private async apply(
    tx: Prisma.TransactionClient,
    reset: OpenReset,
    user: ResetUser,
    input: ConsumePasswordReset,
  ): Promise<boolean> {
    const marked = await tx.passwordReset.updateMany({
      where: { id: reset.id, usedAt: null },
      data: { usedAt: input.now },
    });
    if (marked.count !== 1) {
      return false;
    }
    const updated = await tx.user.update({
      where: { id_tenantId: { id: user.userId, tenantId: user.tenantId } },
      data: {
        passwordHash: input.passwordHash,
        passwordChangedAt: input.now,
        authenticationVersion: { increment: 1 },
      },
      select: { authenticationVersion: true },
    });
    await this.audit.append(tx, auditRow(user, updated.authenticationVersion, input));
    return true;
  }
}

function delivery(input: IssuePasswordReset, resetId: string) {
  return {
    resetId,
    tenantId: input.tenantId,
    recipientEmail: input.email,
    locale: input.locale,
    organizationName: input.organizationName,
    tokenCiphertext: input.tokenCiphertext,
  };
}

function auditRow(user: ResetUser, nextVersion: number, input: ConsumePasswordReset) {
  return {
    tenantId: user.tenantId,
    actorUserId: user.userId,
    actorRole: user.role,
    actorType: 'USER' as const,
    action: 'user.password.reset' as const,
    resourceType: 'user' as const,
    resourceId: user.userId,
    outcome: 'SUCCESS' as const,
    changes: {
      authenticationVersion: { from: nextVersion - 1, to: nextVersion },
    },
    reason: null,
    requestId: input.requestId,
    ipHash: input.client.ipHash,
    userAgent: input.client.userAgent,
  };
}
