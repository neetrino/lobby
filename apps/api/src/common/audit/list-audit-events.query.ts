import type { CursorPage } from '@lobby/contracts';
import type { Prisma } from '@lobby/database' with { 'resolution-mode': 'import' };

import type { TenantId } from '../tenant/tenant-id';
import { encodeAuditEventCursor, type AuditEventListQuery } from './list-audit-events.schema';

export const auditEventListSelect = {
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
} as const;

type AuditEventRow = Prisma.AuditEventGetPayload<{ select: typeof auditEventListSelect }>;

export type AuditEventView = Omit<AuditEventRow, 'occurredAt'> & {
  occurredAt: string;
};

export type AuditEventPage = CursorPage<AuditEventView>;

/** `occurredAt` direction only. `id` is the stable tie-breaker, not a client column. */
export function auditEventOrderBy(
  sort: AuditEventListQuery['sort'],
): Prisma.AuditEventOrderByWithRelationInput[] {
  if (sort === 'asc') {
    return [{ occurredAt: 'asc' }, { id: 'asc' }];
  }
  return [{ occurredAt: 'desc' }, { id: 'desc' }];
}

/** Tenant predicate is applied here. Filters are the allowlisted query fields. */
export function auditEventListWhere(
  tenantId: TenantId,
  query: AuditEventListQuery,
): Prisma.AuditEventWhereInput {
  const where: Prisma.AuditEventWhereInput = {
    tenantId,
    action: query.action,
    outcome: query.outcome,
    actorUserId: query.actorUserId,
    resourceType: query.resourceType,
    resourceId: query.resourceId,
    occurredAt: occurredAtBounds(query),
  };
  const position = cursorPosition(query);
  if (position !== undefined) {
    where.AND = position;
  }
  return where;
}

export function toAuditEventPage(
  rows: readonly AuditEventRow[],
  query: AuditEventListQuery,
): AuditEventPage {
  const visible = rows.slice(0, query.limit);
  const last = visible.at(-1);
  return {
    data: visible.map(toAuditEventView),
    page: { nextCursor: nextCursor(rows.length > query.limit, last, query) },
  };
}

function occurredAtBounds(query: AuditEventListQuery): Prisma.DateTimeFilter | undefined {
  if (query.from === undefined && query.to === undefined) {
    return undefined;
  }
  return {
    gte: query.from === undefined ? undefined : new Date(query.from),
    lte: query.to === undefined ? undefined : new Date(query.to),
  };
}

function cursorPosition(query: AuditEventListQuery): Prisma.AuditEventWhereInput | undefined {
  if (query.cursor === undefined) {
    return undefined;
  }
  const occurredAt = new Date(query.cursor.occurredAt);
  if (query.sort === 'desc') {
    return {
      OR: [{ occurredAt: { lt: occurredAt } }, { occurredAt, id: { lt: query.cursor.id } }],
    };
  }
  return {
    OR: [{ occurredAt: { gt: occurredAt } }, { occurredAt, id: { gt: query.cursor.id } }],
  };
}

function nextCursor(
  hasMore: boolean,
  last: AuditEventRow | undefined,
  query: AuditEventListQuery,
): string | null {
  if (!hasMore || last === undefined) {
    return null;
  }
  return encodeAuditEventCursor({ occurredAt: last.occurredAt.toISOString(), id: last.id }, query);
}

function toAuditEventView(row: AuditEventRow): AuditEventView {
  return {
    id: row.id,
    tenantId: row.tenantId,
    occurredAt: row.occurredAt.toISOString(),
    actorUserId: row.actorUserId,
    actorRole: row.actorRole,
    actorType: row.actorType,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    outcome: row.outcome,
    changes: row.changes,
    reason: row.reason,
    requestId: row.requestId,
    ipHash: row.ipHash,
    userAgent: row.userAgent,
    schemaVersion: row.schemaVersion,
  };
}
