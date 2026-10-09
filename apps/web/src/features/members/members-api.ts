import { AuthRequestError } from '../auth/auth-api';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: 'MEMBER';
  expiresAt: string;
  createdAt: string;
  invitedByName: string;
};

export type TeamSnapshot = {
  members: TeamMember[];
  invitations: PendingInvitation[];
};

export type InvitationPreview = {
  organizationName: string;
  subdomain: string;
  email: string;
  role: 'MEMBER';
};

export async function readTeam(): Promise<TeamSnapshot> {
  return readJson('/api/v1/members/invitations');
}

export function inviteMember(email: string, locale: string): Promise<{ id: string; expiresAt: string }> {
  return sendJson('/api/v1/members/invitations', { email, role: 'MEMBER', locale });
}

export function resendInvitation(
  invitationId: string,
  locale: string,
): Promise<{ id: string; expiresAt: string }> {
  return sendJson(`/api/v1/members/invitations/${invitationId}/resend`, { locale });
}

export function revokeInvitation(invitationId: string): Promise<void> {
  return sendEmpty(`/api/v1/members/invitations/${invitationId}/revoke`);
}

const pendingExchanges = new Map<string, Promise<void>>();

/** Turns the URL token into an HttpOnly cookie. A repeated call shares the in-flight exchange. */
export function exchangeInvitation(invitationId: string, token: string): Promise<void> {
  const existing = pendingExchanges.get(invitationId);
  if (existing !== undefined) {
    return existing;
  }
  const pending = sendEmptyBody('/api/v1/auth/invitations/exchange', { invitationId, token }).finally(
    () => {
      pendingExchanges.delete(invitationId);
    },
  );
  pendingExchanges.set(invitationId, pending);
  return pending;
}

export function previewInvitation(invitationId: string): Promise<InvitationPreview> {
  return sendJson('/api/v1/auth/invitations/preview', { invitationId });
}

export function acceptInvitation(input: {
  invitationId: string;
  name: string;
  password: string;
}): Promise<void> {
  return sendEmptyBody('/api/v1/auth/invitations/accept', input);
}

async function readJson(path: string): Promise<TeamSnapshot> {
  const response = await request(path, { method: 'GET' });
  const body: unknown = await response.json();
  const data = record(body).data;
  if (!isSnapshot(data)) {
    throw new AuthRequestError(200, 'REQUEST_FAILED');
  }
  return data;
}

async function sendJson<T>(path: string, body: unknown): Promise<T> {
  const response = await request(path, { method: 'POST', body: JSON.stringify(body) });
  const payload: unknown = await response.json();
  return record(payload).data as T;
}

async function sendEmpty(path: string): Promise<void> {
  await request(path, { method: 'POST' });
}

async function sendEmptyBody(path: string, body: unknown): Promise<void> {
  await request(path, { method: 'POST', body: JSON.stringify(body) });
}

async function request(path: string, init: { method: string; body?: string }): Promise<Response> {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    method: init.method,
    credentials: 'include',
    headers: {
      accept: 'application/json',
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: init.body,
  });
  if (!response.ok) {
    throw await readError(response);
  }
  return response;
}

async function readError(response: Response): Promise<AuthRequestError> {
  const body: unknown = await response.json().catch(() => null);
  const error = record(body).error;
  const code = record(error).code;
  return new AuthRequestError(response.status, typeof code === 'string' ? code : 'REQUEST_FAILED');
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function isSnapshot(value: unknown): value is TeamSnapshot {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const snapshot = value as TeamSnapshot;
  return Array.isArray(snapshot.members) && Array.isArray(snapshot.invitations);
}
