import { Inject, Injectable } from '@nestjs/common';
import {
  auditSchemaVersion,
  contactLifecycleAuditSchema,
  invitationAuditSchema,
  passwordResetAuditSchema,
  pipelineAuditSchema,
  reservationCreatedAuditSchema,
  reservationLifecycleAuditSchema,
  userSessionsTerminatedAuditSchema,
  type ContactLifecycleAudit,
  type InvitationAudit,
  type PasswordResetAudit,
  type PipelineAudit,
  type ReservationCreatedAudit,
  type ReservationLifecycleAudit,
  type UserSessionsTerminatedAudit,
} from '@lobby/contracts';
import type { Prisma, PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { PRISMA_CLIENT } from '../database/database.tokens';
import type { TenantId } from '../tenant/tenant-id';
import { toAuditDetail, type AuditEventDetail } from './audit-event-view';
import { resourceKey, resourceLabels } from './audit-resource-label';
import {
  auditEventDetailSelect,
  auditEventListSelect,
  auditEventListWhere,
  auditEventOrderBy,
  toAuditEventPage,
  type AuditEventPage,
} from './list-audit-events.query';
import type { AuditEventListQuery } from './list-audit-events.schema';

export type AuditWrite =
  | Omit<UserSessionsTerminatedAudit, 'schemaVersion'>
  | Omit<ContactLifecycleAudit, 'schemaVersion'>
  | Omit<InvitationAudit, 'schemaVersion'>
  | Omit<PasswordResetAudit, 'schemaVersion'>
  | Omit<PipelineAudit, 'schemaVersion'>
  | Omit<ReservationCreatedAudit, 'schemaVersion'>
  | Omit<ReservationLifecycleAudit, 'schemaVersion'>;

/** Append-only audit rows. There is no update and no delete. */
@Injectable()
export class AuditEventStore {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(run);
  }

  async append(tx: Prisma.TransactionClient, input: AuditWrite): Promise<void> {
    const record = parseAuditWrite(input);
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
        actorName: await actorSnapshot(tx, record.tenantId, record.actorUserId),
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

  async list(tenantId: TenantId, query: AuditEventListQuery): Promise<AuditEventPage> {
    const where = auditEventListWhere(tenantId, { ...query, cursor: undefined });
    const total = await this.prisma.auditEvent.count({ where });
    const rows = await this.prisma.auditEvent.findMany({
      where: listedWhere(tenantId, query),
      orderBy: auditEventOrderBy(query.sort),
      skip: pageSkip(query),
      take: query.limit + 1,
      select: auditEventListSelect,
    });
    const labels = await resourceLabels(this.prisma, tenantId, rows);
    return toAuditEventPage(rows, query, labels, total);
  }

  async findOne(tenantId: TenantId, id: string): Promise<AuditEventDetail | null> {
    const row = await this.prisma.auditEvent.findFirst({
      where: { id, tenantId },
      select: auditEventDetailSelect,
    });
    if (row === null) {
      return null;
    }
    const labels = await resourceLabels(this.prisma, tenantId, [row]);
    return toAuditDetail(row, labels.get(resourceKey(row.resourceType, row.resourceId)) ?? null);
  }
}

function listedWhere(tenantId: TenantId, query: AuditEventListQuery) {
  return auditEventListWhere(
    tenantId,
    query.page === undefined ? query : { ...query, cursor: undefined },
  );
}

function pageSkip(query: AuditEventListQuery): number | undefined {
  if (query.page === undefined) return undefined;
  return (query.page - 1) * query.limit;
}

function parseAuditWrite(
  input: AuditWrite,
):
  | UserSessionsTerminatedAudit
  | ContactLifecycleAudit
  | InvitationAudit
  | PasswordResetAudit
  | PipelineAudit
  | ReservationCreatedAudit
  | ReservationLifecycleAudit {
  const record = { ...input, schemaVersion: auditSchemaVersion };
  if (input.action === 'contact.archived' || input.action === 'contact.restored') {
    return contactLifecycleAuditSchema.parse(record);
  }
  if (
    input.action === 'pipeline.configured' ||
    input.action === 'pipeline.card.deleted' ||
    input.action === 'pipeline.card.updated' ||
    input.action === 'deal.stage.changed' ||
    input.action === 'lead.stage.changed' ||
    input.action === 'lead.converted'
  ) {
    return pipelineAuditSchema.parse(record);
  }
  if (input.resourceType === 'memberInvitation') {
    return invitationAuditSchema.parse(record);
  }
  if (input.action === 'user.password.reset') {
    return passwordResetAuditSchema.parse(record);
  }
  if (input.action === 'reservation.created') {
    return reservationCreatedAuditSchema.parse(record);
  }
  if (input.action === 'reservation.updated' || input.action === 'reservation.status.changed') {
    return reservationLifecycleAuditSchema.parse(record);
  }
  return userSessionsTerminatedAuditSchema.parse(record);
}

async function actorSnapshot(
  tx: Prisma.TransactionClient,
  tenantId: string,
  actorUserId: string | null,
): Promise<string | null> {
  if (actorUserId === null) {
    return null;
  }
  const actor = await tx.user.findFirst({
    where: { id: actorUserId, tenantId },
    select: { name: true },
  });
  return actor?.name ?? null;
}
