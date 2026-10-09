const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type AuditActor = {
  id: string | null;
  name: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
  type: 'USER' | 'INTEGRATION';
};

export type AuditEvent = {
  id: string;
  occurredAt: string;
  action: string;
  outcome: string;
  actor: AuditActor;
  resource: { type: string; id: string; label: string | null };
  module: string;
  reason: string | null;
};

export type AuditDetail = AuditEvent & { requestId: string; changes: unknown };
export type AuditPage = { data: AuditEvent[]; page: { nextCursor: string | null } };

export class AuditRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export function listAuditEvents(query: URLSearchParams, signal?: AbortSignal): Promise<AuditPage> {
  return request(`/api/v1/audit-events?${query}`, signal, parsePage);
}

export function readAuditEvent(id: string, signal?: AbortSignal): Promise<AuditDetail> {
  return request(`/api/v1/audit-events/${id}`, signal, parseDetail);
}

async function request<T>(
  path: string,
  signal: AbortSignal | undefined,
  parse: (value: unknown) => T,
): Promise<T> {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    credentials: 'include',
    headers: { accept: 'application/json' },
    signal,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = isRecord(body) && isRecord(body.error) ? body.error : null;
    throw new AuditRequestError(
      response.status,
      error !== null && typeof error.code === 'string' ? error.code : 'REQUEST_FAILED',
    );
  }
  return parse(body);
}

function parsePage(value: unknown): AuditPage {
  if (!isRecord(value) || !Array.isArray(value.data) || !isRecord(value.page)) invalid();
  const nextCursor = value.page.nextCursor;
  if (nextCursor !== null && typeof nextCursor !== 'string') invalid();
  return { data: value.data.map(parseEvent), page: { nextCursor } };
}

function parseDetail(value: unknown): AuditDetail {
  const event = parseEvent(value);
  if (!isRecord(value) || typeof value.requestId !== 'string') invalid();
  return { ...event, requestId: value.requestId, changes: value.changes ?? null };
}

function parseEvent(value: unknown): AuditEvent {
  if (!isRecord(value) || !isRecord(value.actor) || !isRecord(value.resource)) invalid();
  if (
    typeof value.id !== 'string' ||
    typeof value.occurredAt !== 'string' ||
    typeof value.action !== 'string' ||
    typeof value.outcome !== 'string' ||
    typeof value.module !== 'string' ||
    typeof value.resource.type !== 'string' ||
    typeof value.resource.id !== 'string' ||
    typeof value.actor.type !== 'string'
  )
    invalid();
  return {
    id: value.id,
    occurredAt: value.occurredAt,
    action: value.action,
    outcome: value.outcome,
    module: value.module,
    reason: nullable(value.reason),
    actor: {
      id: nullable(value.actor.id),
      name: nullable(value.actor.name),
      role: role(value.actor.role),
      type: value.actor.type === 'INTEGRATION' ? 'INTEGRATION' : 'USER',
    },
    resource: {
      type: value.resource.type,
      id: value.resource.id,
      label: nullable(value.resource.label),
    },
  };
}

function role(value: unknown): AuditActor['role'] {
  return value === 'OWNER' || value === 'ADMIN' || value === 'MEMBER' ? value : null;
}

function nullable(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function invalid(): never {
  throw new AuditRequestError(200, 'REQUEST_FAILED');
}
