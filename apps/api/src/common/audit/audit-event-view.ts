import type { Prisma } from '@lobby/database' with { 'resolution-mode': 'import' };

const SENSITIVE_KEY = /password|token|secret|session|cookie|authorization|credential|hash/i;

const MODULES: Record<string, string> = {
  user: 'identity',
  memberInvitation: 'members',
  contact: 'contacts',
  deal: 'pipelines',
  lead: 'pipelines',
  pipeline: 'pipelines',
  reservation: 'reservations',
};

export type AuditActorView = {
  id: string | null;
  name: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
  type: 'USER' | 'INTEGRATION';
};

export type AuditResourceView = {
  type: string;
  id: string;
  label: string | null;
};

export type AuditEventListItem = {
  id: string;
  occurredAt: string;
  action: string;
  outcome: string;
  actor: AuditActorView;
  resource: AuditResourceView;
  module: string;
  reason: string | null;
};

export type AuditEventDetail = AuditEventListItem & {
  requestId: string;
  changes: unknown;
};

type ListRow = {
  id: string;
  occurredAt: Date;
  actorUserId: string | null;
  actorName: string | null;
  actorRole: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
  actorType: 'USER' | 'INTEGRATION';
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: string;
  reason: string | null;
  actor: { name: string } | null;
};

type DetailRow = ListRow & {
  requestId: string;
  changes: Prisma.JsonValue | null;
};

export function toAuditListItem(row: ListRow, label: string | null): AuditEventListItem {
  return {
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    action: row.action,
    outcome: row.outcome,
    actor: actorOf(row),
    resource: { type: row.resourceType, id: row.resourceId, label },
    module: MODULES[row.resourceType] ?? row.resourceType,
    reason: row.reason,
  };
}

export function toAuditDetail(row: DetailRow, label: string | null): AuditEventDetail {
  return {
    ...toAuditListItem(row, label),
    requestId: row.requestId,
    changes: sanitizeChanges(row.changes),
  };
}

/** Drops credential-shaped keys at every depth. Stored audit schemas already omit them. */
export function sanitizeChanges(value: Prisma.JsonValue | null): unknown {
  if (value === null) {
    return null;
  }
  return stripSensitive(value);
}

function actorOf(row: ListRow): AuditActorView {
  return {
    id: row.actorUserId,
    name: actorName(row),
    role: row.actorRole,
    type: row.actorType,
  };
}

function actorName(row: ListRow): string | null {
  if (row.actorName !== null && row.actorName.length > 0) {
    return row.actorName;
  }
  if (row.actor !== null) {
    return row.actor.name;
  }
  return row.actorUserId === null ? null : 'Former user';
}

function stripSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripSensitive);
  }
  if (!isRecord(value)) {
    return value;
  }
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (!isSensitiveKey(key)) {
      next[key] = stripSensitive(child);
    }
  }
  return next;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY.test(key) || normalized === 'body' || normalized === 'requestbody';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
