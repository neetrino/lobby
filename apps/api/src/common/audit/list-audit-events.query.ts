import type { Prisma } from '@lobby/database' with { 'resolution-mode': 'import' };

import type { TenantId } from '../tenant/tenant-id';
import { toAuditListItem, type AuditEventListItem } from './audit-event-view';
import { resourceKey } from './audit-resource-label';
import { encodeAuditEventCursor, type AuditEventListQuery } from './list-audit-events.schema';

export const auditEventListSelect = {
  id: true,
  occurredAt: true,
  actorUserId: true,
  actorName: true,
  actorRole: true,
  actorType: true,
  action: true,
  resourceType: true,
  resourceId: true,
  outcome: true,
  reason: true,
  actor: { select: { name: true } },
} as const;

export const auditEventDetailSelect = {
  ...auditEventListSelect,
  requestId: true,
  changes: true,
} as const;

type AuditEventRow = Prisma.AuditEventGetPayload<{ select: typeof auditEventListSelect }>;

export type AuditEventPage = {
  data: AuditEventListItem[];
  page: { nextCursor: string | null; total: number };
};

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
  const and = [cursorPosition(query), searchClause(query)].filter(
    (clause): clause is Prisma.AuditEventWhereInput => clause !== undefined,
  );
  return {
    tenantId,
    action: query.action,
    outcome: query.outcome,
    actorUserId: query.actorUserId,
    actorType: query.actorType,
    resourceType: query.resourceType,
    resourceId: query.resourceId,
    occurredAt: occurredAtBounds(query),
    ...(and.length === 0 ? {} : { AND: and }),
  };
}

export function toAuditEventPage(
  rows: readonly AuditEventRow[],
  query: AuditEventListQuery,
  labels: ReadonlyMap<string, string>,
  total: number,
): AuditEventPage {
  const visible = rows.slice(0, query.limit);
  const last = visible.at(-1);
  return {
    data: visible.map((row) =>
      toAuditListItem(row, labels.get(resourceKey(row.resourceType, row.resourceId)) ?? null),
    ),
    page: { nextCursor: nextCursor(rows.length > query.limit, last, query), total },
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
  const id = query.sort === 'desc' ? { lt: query.cursor.id } : { gt: query.cursor.id };
  const occurred = query.sort === 'desc' ? { lt: occurredAt } : { gt: occurredAt };
  return { OR: [{ occurredAt: occurred }, { occurredAt, id }] };
}

function searchClause(query: AuditEventListQuery): Prisma.AuditEventWhereInput | undefined {
  if (query.search === undefined) {
    return undefined;
  }
  const contains = { contains: query.search, mode: 'insensitive' as const };
  return {
    OR: [
      { action: contains },
      { reason: contains },
      { actorName: contains },
      { actor: { is: { name: contains } } },
    ],
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
