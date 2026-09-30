import { Inject, Injectable } from '@nestjs/common';
import {
  auditSchemaVersion,
  userSessionsTerminatedAuditSchema,
  type UserSessionsTerminatedAudit,
} from '@lobby/contracts';
import type { Prisma, PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { PRISMA_CLIENT } from '../database/database.tokens';
import type { TenantId } from '../tenant/tenant-id';

export type AuditWrite = Omit<UserSessionsTerminatedAudit, 'schemaVersion'>;

/** Append-only audit rows. There is no update and no delete. */
@Injectable()
export class AuditEventStore {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(run);
  }

  async append(tx: Prisma.TransactionClient, input: AuditWrite): Promise<void> {
    const record = userSessionsTerminatedAuditSchema.parse({
      ...input,
      schemaVersion: auditSchemaVersion,
    });
    await tx.auditEvent.create({
      data: {
        tenantId: record.tenantId,
        actorUserId: record.actorUserId,
        actorRole: record.actorRole,
        actorType: record.actorType,
        action: record.action,
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        outcome: record.outcome,
        changes: record.changes ?? undefined,
        reason: record.reason,
        requestId: record.requestId,
        ipHash: record.ipHash,
        userAgent: record.userAgent,
        schemaVersion: record.schemaVersion,
      },
    });
  }

  async appendNow(input: AuditWrite): Promise<void> {
    await this.transaction((tx) => this.append(tx, input));
  }

  list(tenantId: TenantId) {
    return this.prisma.auditEvent.findMany({
      where: { tenantId },
      orderBy: { occurredAt: 'asc' },
      select: {
        id: true,
        tenantId: true,
        occurredAt: true,
        actorUserId: true,
        actorRole: true,
        actorType: true,
        action: true,
        resourceType: true,
        resourceId: true,
        outcome: true,
        changes: true,
        reason: true,
        requestId: true,
        ipHash: true,
        userAgent: true,
        schemaVersion: true,
      },
    });
  }
}
