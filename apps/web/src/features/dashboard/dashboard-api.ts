import type { DashboardRangeDays, DashboardScope } from '@lobby/contracts';

import { ContactsRequestError, readSession } from '../contacts/contacts-api';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type DashboardCard = {
  key: string;
  value: number;
  previous: number | null;
  trend: number | null;
};

export type DashboardWorkItem = {
  id: string;
  label: string;
  detail: string;
  href: string | null;
};

export type DashboardBoard = {
  generatedAt: string;
  rangeDays: DashboardRangeDays;
  scope: DashboardScope;
  layout: { widgets: Array<{ key: string; enabled: boolean }> };
  overview: DashboardCard[];
  work: Array<{ key: string; items: DashboardWorkItem[] }>;
  reservations?: {
    expectedGuests: number;
    pendingConfirmations: number;
    cancellations: number;
    occupiedTables: number;
    activeTables: number;
    upcoming: Array<{ id: string; label: string; partySize: number; startsAt: string; status: string }>;
  };
  activity?: { items: Array<{ id: string; kind: string; label: string; occurredAt: string; href: string | null }> };
  activityTrend?: {
    days: Array<{
      date: string;
      created: number | null;
      updated: number | null;
      archived: number | null;
      invited: number | null;
      accepted: number | null;
    }>;
  };
  reservationLoad?: {
    capacity: number | null;
    today: Array<{ hour: number; guests: number }>;
    tomorrow: Array<{ hour: number; guests: number }>;
    week: Array<{ hour: number; guests: number }>;
  };
  analytics?: {
    contactGrowth: { current: number; previous: number; trend: number | null } | null;
    occupancy: { occupied: number; active: number } | null;
  };
  failures: Array<{ widget: string }>;
};

export { ContactsRequestError as DashboardRequestError, readSession };

export function readDashboard(
  query: { range?: DashboardRangeDays; scope?: DashboardScope },
  signal?: AbortSignal,
): Promise<DashboardBoard> {
  const params = new URLSearchParams();
  if (query.range !== undefined) {
    params.set('range', String(query.range));
  }
  if (query.scope !== undefined) {
    params.set('scope', query.scope);
  }
  const suffix = params.size === 0 ? '' : `?${params.toString()}`;
  return request(`/api/v1/dashboard${suffix}`, { method: 'GET' }, signal);
}

export function saveDashboardLayout(body: {
  rangeDays: DashboardRangeDays;
  scope: DashboardScope;
  widgets: string[];
}): Promise<DashboardBoard> {
  return request('/api/v1/dashboard/layout', { method: 'PUT', body: JSON.stringify(body) });
}

async function request(path: string, init: RequestInit, signal?: AbortSignal): Promise<DashboardBoard> {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    signal,
    credentials: 'include',
    headers: {
      accept: 'application/json',
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
  });
  if (!response.ok) {
    throw await readError(response);
  }
  return parseBoard(await response.json());
}

function parseBoard(value: unknown): DashboardBoard {
  if (!isRecord(value) || !isRecord(value.data)) {
    throw new ContactsRequestError(500, 'REQUEST_FAILED');
  }
  const data = value.data;
  if (typeof data.generatedAt !== 'string' || !Array.isArray(data.overview) || !Array.isArray(data.failures)) {
    throw new ContactsRequestError(500, 'REQUEST_FAILED');
  }
  return data as DashboardBoard;
}

async function readError(response: Response): Promise<ContactsRequestError> {
  const body: unknown = await response.json().catch(() => null);
  const error = isRecord(body) ? body.error : undefined;
  const code = isRecord(error) && typeof error.code === 'string' ? error.code : 'REQUEST_FAILED';
  return new ContactsRequestError(response.status, code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
