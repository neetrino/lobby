import { Inject, Injectable } from '@nestjs/common';
import {
  auditSchemaVersion,
  contactLifecycleAuditSchema,
  invitationAuditSchema,
  passwordResetAuditSchema,
  pipelineAuditSchema,
  reservationCreatedAuditSchema,
  userSessionsTerminatedAuditSchema,
  type ContactLifecycleAudit,
  type InvitationAudit,
  type PasswordResetAudit,
  type PipelineAudit,
  type ReservationCreatedAudit,
  type UserSessionsTerminatedAudit,
} from '@lobby/contracts';
import type { Prisma, PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { PRISMA_CLIENT } from '../database/database.tokens';
import type { TenantId } from '../tenant/tenant-id';
import {
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
  | Omit<ReservationCreatedAudit, 'schemaVersion'>;

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
    const rows = await this.prisma.auditEvent.findMany({
      where: auditEventListWhere(tenantId, query),
      orderBy: auditEventOrderBy(query.sort),
      take: query.limit + 1,
      select: auditEventListSelect,
    });
    return toAuditEventPage(rows, query);
  }
}

function parseAuditWrite(
  input: AuditWrite,
):
  | UserSessionsTerminatedAudit
  | ContactLifecycleAudit
  | InvitationAudit
  | PasswordResetAudit
  | PipelineAudit
  | ReservationCreatedAudit {
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
  return userSessionsTerminatedAuditSchema.parse(record);
}
