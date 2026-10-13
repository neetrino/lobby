import { ContactsRequestError } from '../contacts/contacts-api';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type PlatformOrganization = {
  name: string;
  subdomain: string;
  ownerEmail: string;
  createdAt: string;
};

export type NewOrganization = {
  name: string;
  subdomain: string;
  ownerName: string;
  ownerEmail: string;
  password: string;
};

export function listOrganizations(signal?: AbortSignal): Promise<PlatformOrganization[]> {
  return request('/api/v1/platform/organizations', { method: 'GET' }, signal, parseList);
}

export function createOrganization(input: NewOrganization): Promise<PlatformOrganization> {
  return request(
    '/api/v1/platform/organizations',
    {
      method: 'POST',
      body: JSON.stringify({
        tenant: { name: input.name.trim(), subdomain: input.subdomain.trim().toLowerCase() },
        owner: {
          name: input.ownerName.trim(),
          email: input.ownerEmail.trim().toLowerCase(),
          password: input.password,
        },
      }),
    },
    undefined,
    parseOne,
  );
}

async function request<T>(
  path: string,
  init: RequestInit,
  signal: AbortSignal | undefined,
  parse: (body: unknown) => T,
): Promise<T> {
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
  return parse(await response.json());
}

function parseList(body: unknown): PlatformOrganization[] {
  if (!isRecord(body) || !Array.isArray(body.data)) {
    throw new ContactsRequestError(200, 'REQUEST_FAILED');
  }
  return body.data.map(parseOrganization);
}

function parseOne(body: unknown): PlatformOrganization {
  if (!isRecord(body)) {
    throw new ContactsRequestError(200, 'REQUEST_FAILED');
  }
  const organization = parseOrganization(body.data);
  return { ...organization, createdAt: organization.createdAt || new Date(0).toISOString() };
}

function parseOrganization(value: unknown): PlatformOrganization {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    typeof value.subdomain !== 'string' ||
    typeof value.ownerEmail !== 'string'
  ) {
    throw new ContactsRequestError(200, 'REQUEST_FAILED');
  }
  return {
    name: value.name,
    subdomain: value.subdomain,
    ownerEmail: value.ownerEmail,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
  };
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
