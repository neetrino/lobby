import type { CursorPage } from '@lobby/contracts';

import type { Contact, ContactDraft, ContactWarning, SessionPrincipal } from './contact';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ContactsRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: readonly string[];

  constructor(status: number, code: string, fields: readonly string[] = []) {
    super(code);
    this.name = 'ContactsRequestError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function listContacts(query: string, signal?: AbortSignal): Promise<CursorPage<Contact>> {
  return requestJson(`/api/v1/contacts?${query}`, { method: 'GET' }, signal, parseContactPage);
}

export function readContact(contactId: string, signal?: AbortSignal): Promise<Contact> {
  return requestJson(`/api/v1/contacts/${contactId}`, { method: 'GET' }, signal, parseContactData);
}

export function createContact(
  draft: ContactDraft,
): Promise<{ contact: Contact; warnings: ContactWarning[] }> {
  return requestJson(
    '/api/v1/contacts',
    { method: 'POST', body: JSON.stringify(draftBody(draft)) },
    undefined,
    parseContactWrite,
  );
}

export function updateContact(
  contactId: string,
  draft: ContactDraft,
): Promise<{ contact: Contact; warnings: ContactWarning[] }> {
  return requestJson(
    `/api/v1/contacts/${contactId}`,
    { method: 'PATCH', body: JSON.stringify(draftBody(draft)) },
    undefined,
    parseContactWrite,
  );
}

export function archiveContact(contactId: string): Promise<Contact> {
  return requestJson(
    `/api/v1/contacts/${contactId}/archive`,
    { method: 'POST' },
    undefined,
    parseContactData,
  );
}

export function restoreContact(contactId: string): Promise<Contact> {
  return requestJson(
    `/api/v1/contacts/${contactId}/restore`,
    { method: 'POST' },
    undefined,
    parseContactData,
  );
}

export function readSession(signal?: AbortSignal): Promise<SessionPrincipal> {
  return requestJson('/api/v1/auth/session', { method: 'GET' }, signal, parseSession);
}

export function toRequestError(error: unknown): ContactsRequestError {
  if (error instanceof ContactsRequestError) {
    return error;
  }
  return new ContactsRequestError(0, 'REQUEST_FAILED');
}

function draftBody(draft: ContactDraft): {
  name: string;
  type: ContactDraft['type'];
  email: string | null;
  phone: string | null;
} {
  return {
    name: draft.name.trim(),
    type: draft.type,
    email: blankToNull(draft.email.trim().toLowerCase()),
    phone: blankToNull(draft.phone.trim()),
  };
}

function blankToNull(value: string): string | null {
  return value.length === 0 ? null : value;
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
    headers: jsonHeaders(init.body),
  });
  if (!response.ok) {
    throw await readError(response);
  }
  return parse(await response.json());
}

function jsonHeaders(body: BodyInit | null | undefined): HeadersInit {
  return body === undefined
    ? { accept: 'application/json' }
    : { accept: 'application/json', 'content-type': 'application/json' };
}

async function readError(response: Response): Promise<ContactsRequestError> {
  const body: unknown = await response.json().catch(() => null);
  const error = isRecord(body) ? body.error : undefined;
  if (!isRecord(error) || typeof error.code !== 'string') {
    return new ContactsRequestError(response.status, 'REQUEST_FAILED');
  }
  const fields = Array.isArray(error.fields) ? error.fields.flatMap(fieldPath) : [];
  return new ContactsRequestError(response.status, error.code, fields);
}

function fieldPath(field: unknown): string[] {
  if (!isRecord(field) || typeof field.path !== 'string') {
    return [];
  }
  return [field.path];
}

function parseContactPage(body: unknown): CursorPage<Contact> {
  if (!isRecord(body) || !Array.isArray(body.data) || !isRecord(body.page)) {
    throw new ContactsRequestError(200, 'REQUEST_FAILED');
  }
  const nextCursor = body.page.nextCursor;
  if (nextCursor !== null && typeof nextCursor !== 'string') {
    throw new ContactsRequestError(200, 'REQUEST_FAILED');
  }
  return { data: body.data.map(parseContact), page: { nextCursor } };
}

function parseContactData(body: unknown): Contact {
  if (!isRecord(body)) {
    throw new ContactsRequestError(200, 'REQUEST_FAILED');
  }
  return parseContact(body.data);
}

function parseContactWrite(body: unknown): { contact: Contact; warnings: ContactWarning[] } {
  if (!isRecord(body)) {
    throw new ContactsRequestError(200, 'REQUEST_FAILED');
  }
  return { contact: parseContact(body.data), warnings: parseWarnings(body.warnings) };
}

function parseSession(body: unknown): SessionPrincipal {
  if (!isRecord(body) || !isRecord(body.data) || !isSession(body.data)) {
    throw new ContactsRequestError(200, 'REQUEST_FAILED');
  }
  return body.data;
}

function parseWarnings(value: unknown): ContactWarning[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new ContactsRequestError(200, 'REQUEST_FAILED');
  }
  return value.map(parseWarning);
}

function parseWarning(value: unknown): ContactWarning {
  if (
    !isRecord(value) ||
    value.code !== 'POSSIBLE_DUPLICATE' ||
    typeof value.contactId !== 'string'
  ) {
    throw new ContactsRequestError(200, 'REQUEST_FAILED');
  }
  return { code: 'POSSIBLE_DUPLICATE', contactId: value.contactId };
}

function parseContact(value: unknown): Contact {
  if (!isContact(value)) {
    throw new ContactsRequestError(200, 'REQUEST_FAILED');
  }
  return value;
}

function isContact(value: unknown): value is Contact {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    (value.type === 'person' || value.type === 'organization') &&
    isNullableString(value.email) &&
    isNullableString(value.phone) &&
    isNullableString(value.archivedAt) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    typeof value.createdByUserId === 'string' &&
    typeof value.ownerUserId === 'string'
  );
}

function isSession(value: Record<string, unknown>): value is SessionPrincipal {
  if (!isRecord(value.user) || !isRecord(value.tenant)) {
    return false;
  }
  const role = value.user.role;
  return (
    typeof value.user.id === 'string' &&
    (role === 'OWNER' || role === 'ADMIN' || role === 'MEMBER') &&
    typeof value.tenant.id === 'string'
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
