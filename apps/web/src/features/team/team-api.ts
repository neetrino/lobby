import {
  directMessagePageSchema,
  directMessageResponseSchema,
  MAX_PAGE_LIMIT,
  teamDirectoryResponseSchema,
  teamMemberResponseSchema,
  type DirectMessage,
  type DirectMessagePage,
  type TeamDirectory,
  type TeamMember,
} from '@lobby/contracts';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type { DirectMessage, TeamDirectory, TeamMember };

export class TeamRequestError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'TeamRequestError';
    this.code = code;
  }
}

export function readTeamDirectory(signal?: AbortSignal): Promise<TeamDirectory> {
  return request('/api/v1/team', { method: 'GET' }, signal, (body) => readSchema(teamDirectoryResponseSchema, body).data);
}

export function updateJobTitle(userId: string, jobTitle: string | null): Promise<TeamMember> {
  return request(
    `/api/v1/team/members/${userId}`,
    { method: 'PATCH', body: JSON.stringify({ jobTitle }) },
    undefined,
    (body) => readSchema(teamMemberResponseSchema, body).data,
  );
}

export function readDirectMessages(
  userId: string,
  cursor?: string | null,
  signal?: AbortSignal,
): Promise<DirectMessagePage> {
  const params = new URLSearchParams();
  if (cursor !== undefined && cursor !== null && cursor.length > 0) {
    params.set('cursor', cursor);
  }
  const query = params.size === 0 ? '' : `?${params.toString()}`;
  return request(`/api/v1/team/members/${userId}/messages${query}`, { method: 'GET' }, signal, (body) =>
    readSchema(directMessagePageSchema, body),
  );
}

/** Messages strictly newer than `after`, oldest first. `page.nextCursor` continues forward. */
export function readNewerMessages(
  userId: string,
  after: string,
  signal?: AbortSignal,
): Promise<DirectMessagePage> {
  const params = new URLSearchParams({ after, limit: String(MAX_PAGE_LIMIT) });
  return request(
    `/api/v1/team/members/${userId}/messages?${params.toString()}`,
    { method: 'GET' },
    signal,
    (body) => readSchema(directMessagePageSchema, body),
  );
}

export function sendDirectMessage(userId: string, body: string): Promise<DirectMessage> {
  return request(
    `/api/v1/team/members/${userId}/messages`,
    { method: 'POST', body: JSON.stringify({ body }) },
    undefined,
    (payload) => readSchema(directMessageResponseSchema, payload).data,
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
    headers: init.body === undefined
      ? { accept: 'application/json' }
      : { accept: 'application/json', 'content-type': 'application/json' },
  });
  if (!response.ok) {
    throw await readError(response);
  }
  return parse(await response.json());
}

function readSchema<T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new TeamRequestError('REQUEST_FAILED');
  }
  return parsed.data;
}

async function readError(response: Response): Promise<TeamRequestError> {
  const body: unknown = await response.json().catch(() => null);
  const error = isRecord(body) ? body.error : undefined;
  if (!isRecord(error) || typeof error.code !== 'string') {
    return new TeamRequestError('REQUEST_FAILED');
  }
  return new TeamRequestError(error.code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
