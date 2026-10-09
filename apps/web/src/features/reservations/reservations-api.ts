import type {
  DiningTable,
  ReservationDetail,
  ReservationFilters,
  ReservationSummary,
  ReservationTransitionAction,
  StaffSource,
  StatusHistoryItem,
  Venue,
} from './reservations-model';
import { rangeBounds } from './reservations-model';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ReservationRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'ReservationRequestError';
    this.status = status;
    this.code = code;
  }
}

export type ReservationPage = {
  rows: ReservationSummary[];
  nextCursor: string | null;
};

export type ReservationDraft = {
  locationId: string;
  tableId: string;
  startsAt: string;
  durationMinutes: number;
  guestCount: number;
  customerName: string;
  phone: string;
  email: string;
  contactId: string;
  assignedUserId: string;
  customerNote: string;
  source: StaffSource;
};

export function listReservations(filters: ReservationFilters, signal?: AbortSignal): Promise<ReservationPage> {
  return requestJson(`/api/v1/reservations?${listQuery(filters)}`, { method: 'GET' }, signal, parsePage);
}

export function readReservation(id: string, signal?: AbortSignal): Promise<ReservationDetail> {
  return requestJson(`/api/v1/reservations/${id}`, { method: 'GET' }, signal, parseDetail);
}

export function readHistory(id: string, signal?: AbortSignal): Promise<StatusHistoryItem[]> {
  return requestJson(`/api/v1/reservations/${id}/history`, { method: 'GET' }, signal, parseHistory);
}

export function listVenues(signal?: AbortSignal): Promise<Venue[]> {
  return requestJson('/api/v1/reservation-locations', { method: 'GET' }, signal, parseVenues);
}

export function listDiningTables(locationId: string, signal?: AbortSignal): Promise<DiningTable[]> {
  return requestJson(
    `/api/v1/reservation-locations/${locationId}/tables`,
    { method: 'GET' },
    signal,
    parseTables,
  );
}

export function listAvailableTables(input: {
  locationId: string;
  startsAt: string;
  durationMinutes: number;
  guestCount: number;
  excludeReservationId?: string;
}, signal?: AbortSignal): Promise<DiningTable[]> {
  const params = new URLSearchParams({
    locationId: input.locationId,
    startsAt: input.startsAt,
    durationMinutes: String(input.durationMinutes),
    guestCount: String(input.guestCount),
  });
  if (input.excludeReservationId !== undefined) {
    params.set('excludeReservationId', input.excludeReservationId);
  }
  return requestJson(`/api/v1/reservation-availability?${params}`, { method: 'GET' }, signal, parseAvailability);
}

export function createReservation(draft: ReservationDraft): Promise<ReservationSummary> {
  return requestJson(
    '/api/v1/reservations',
    { method: 'POST', body: JSON.stringify(createBody(draft)) },
    undefined,
    (body) => parseSummary(record(body).data),
  );
}

export function updateReservation(id: string, draft: ReservationDraft): Promise<ReservationSummary> {
  return requestJson(
    `/api/v1/reservations/${id}`,
    { method: 'PATCH', body: JSON.stringify(updateBody(draft)) },
    undefined,
    (body) => parseSummary(record(body).data),
  );
}

export function cancelReservation(id: string, reason: string): Promise<ReservationSummary> {
  const body = reason.trim().length === 0 ? {} : { reason: reason.trim() };
  return requestJson(
    `/api/v1/reservations/${id}/cancel`,
    { method: 'POST', body: JSON.stringify(body) },
    undefined,
    (payload) => parseSummary(record(payload).data),
  );
}

export function transitionReservation(
  id: string,
  action: ReservationTransitionAction,
): Promise<ReservationSummary> {
  return requestJson(
    `/api/v1/reservations/${id}/transitions/${action}`,
    { method: 'POST', body: JSON.stringify({}) },
    undefined,
    (body) => parseSummary(record(body).data),
  );
}

function listQuery(filters: ReservationFilters): string {
  const bounds = rangeBounds(filters.fromDay, filters.toDay);
  const params = new URLSearchParams({ limit: '50', sort: 'asc', from: bounds.from, to: bounds.to });
  if (filters.status !== '') params.set('status', filters.status);
  if (filters.locationId !== '') params.set('locationId', filters.locationId);
  if (filters.assigneeId !== '') params.set('assignedUserId', filters.assigneeId);
  if (filters.search !== '') params.set('search', filters.search);
  if (filters.cursor !== null) params.set('cursor', filters.cursor);
  return params.toString();
}

function createBody(draft: ReservationDraft): Record<string, unknown> {
  return {
    locationId: draft.locationId,
    startsAt: new Date(draft.startsAt).toISOString(),
    durationMinutes: draft.durationMinutes,
    guestCount: draft.guestCount,
    requestedTableId: draft.tableId,
    customer: customerBody(draft),
    ...(draft.assignedUserId === '' ? {} : { assignedUserId: draft.assignedUserId }),
    ...(draft.customerNote.trim() === '' ? {} : { customerNote: draft.customerNote.trim() }),
    source: { type: draft.source },
  };
}

function updateBody(draft: ReservationDraft): Record<string, unknown> {
  return {
    locationId: draft.locationId,
    startsAt: new Date(draft.startsAt).toISOString(),
    durationMinutes: draft.durationMinutes,
    guestCount: draft.guestCount,
    requestedTableId: draft.tableId,
    assignedUserId: draft.assignedUserId === '' ? null : draft.assignedUserId,
    contactId: draft.contactId === '' ? null : draft.contactId,
    customerName: draft.customerName.trim(),
    customerPhone: blankToNull(draft.phone),
    customerEmail: blankToNull(draft.email),
    customerNote: blankToNull(draft.customerNote),
  };
}

function customerBody(draft: ReservationDraft): Record<string, unknown> {
  return {
    name: draft.customerName.trim(),
    ...(draft.phone.trim() === '' ? {} : { phone: draft.phone.trim() }),
    ...(draft.email.trim() === '' ? {} : { email: draft.email.trim() }),
    ...(draft.contactId === '' ? {} : { contactId: draft.contactId }),
  };
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  signal: AbortSignal | undefined,
  parse: (body: unknown) => T,
): Promise<T> {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    signal,
    credentials: 'include',
    headers: init.body === undefined
      ? { accept: 'application/json' }
      : { accept: 'application/json', 'content-type': 'application/json' },
  });
  if (!response.ok) {
    throw await readError(response);
  }
  return parse(await response.json());
}

async function readError(response: Response): Promise<ReservationRequestError> {
  const body: unknown = await response.json().catch(() => null);
  const error = isRecord(body) ? body.error : undefined;
  if (!isRecord(error) || typeof error.code !== 'string') {
    return new ReservationRequestError(response.status, 'REQUEST_FAILED');
  }
  return new ReservationRequestError(response.status, error.code);
}

function parsePage(body: unknown): ReservationPage {
  const page = record(body);
  if (!Array.isArray(page.data) || !isRecord(page.page)) {
    throw new ReservationRequestError(200, 'REQUEST_FAILED');
  }
  const nextCursor = page.page.nextCursor;
  return {
    rows: page.data.map(parseSummary),
    nextCursor: typeof nextCursor === 'string' ? nextCursor : null,
  };
}

function parseDetail(body: unknown): ReservationDetail {
  const value = record(body).data;
  const summary = parseSummary(value);
  if (!isRecord(value) || typeof value.durationMinutes !== 'number' || typeof value.source !== 'string') {
    throw new ReservationRequestError(200, 'REQUEST_FAILED');
  }
  return {
    ...summary,
    contactId: nullableString(value.contactId),
    assignedUserId: nullableString(value.assignedUserId),
    source: value.source,
    durationMinutes: value.durationMinutes,
    customerPhone: nullableString(value.customerPhone),
    customerEmail: nullableString(value.customerEmail),
    customerNote: nullableString(value.customerNote),
  };
}

function parseHistory(body: unknown): StatusHistoryItem[] {
  const data = record(body).data;
  if (!Array.isArray(data)) throw new ReservationRequestError(200, 'REQUEST_FAILED');
  return data.map(parseHistoryItem);
}

function parseHistoryItem(value: unknown): StatusHistoryItem {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.toStatus !== 'string' || typeof value.createdAt !== 'string') {
    throw new ReservationRequestError(200, 'REQUEST_FAILED');
  }
  return {
    id: value.id,
    fromStatus: nullableString(value.fromStatus),
    toStatus: value.toStatus,
    changedByName: nullableString(value.changedByName),
    reason: nullableString(value.reason),
    createdAt: value.createdAt,
  };
}

function parseVenues(body: unknown): Venue[] {
  const data = record(body).data;
  if (!Array.isArray(data)) throw new ReservationRequestError(200, 'REQUEST_FAILED');
  return data.map((item) => {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.timezone !== 'string') {
      throw new ReservationRequestError(200, 'REQUEST_FAILED');
    }
    return { id: item.id, name: item.name, timezone: item.timezone };
  });
}

function parseTables(body: unknown): DiningTable[] {
  const data = record(body).data;
  if (!Array.isArray(data)) throw new ReservationRequestError(200, 'REQUEST_FAILED');
  return data.map(parseTable);
}

function parseAvailability(body: unknown): DiningTable[] {
  const data = record(body).data;
  if (!isRecord(data) || !Array.isArray(data.tables)) {
    throw new ReservationRequestError(200, 'REQUEST_FAILED');
  }
  return data.tables.map(parseTable);
}

function parseTable(value: unknown): DiningTable {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.locationId !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.minCapacity !== 'number' ||
    typeof value.capacity !== 'number'
  ) {
    throw new ReservationRequestError(200, 'REQUEST_FAILED');
  }
  return {
    id: value.id,
    locationId: value.locationId,
    name: value.name,
    minCapacity: value.minCapacity,
    capacity: value.capacity,
  };
}

function parseSummary(value: unknown): ReservationSummary {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.status !== 'string' ||
    typeof value.locationId !== 'string' ||
    typeof value.guestCount !== 'number' ||
    typeof value.startsAt !== 'string' ||
    typeof value.endsAt !== 'string' ||
    typeof value.customerName !== 'string'
  ) {
    throw new ReservationRequestError(200, 'REQUEST_FAILED');
  }
  return {
    id: value.id,
    status: value.status,
    locationId: value.locationId,
    tableId: nullableString(value.tableId),
    guestCount: value.guestCount,
    startsAt: value.startsAt,
    endsAt: value.endsAt,
    customerName: value.customerName,
  };
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new ReservationRequestError(200, 'REQUEST_FAILED');
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
