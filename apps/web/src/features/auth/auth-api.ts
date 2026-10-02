const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class AuthRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'AuthRequestError';
    this.status = status;
    this.code = code;
  }
}

export function loginAccount(input: {
  workspace: string;
  email: string;
  password: string;
}): Promise<void> {
  return send('/api/v1/auth/login', {
    subdomain: input.workspace.trim().toLowerCase(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });
}

export function registerOwner(input: {
  organization: string;
  workspace: string;
  name: string;
  email: string;
  password: string;
}): Promise<void> {
  return send('/api/v1/auth/register', {
    tenant: {
      name: input.organization.trim(),
      subdomain: input.workspace.trim().toLowerCase(),
      plan: 'starter',
    },
    owner: {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
    },
  });
}

export async function hasSession(): Promise<boolean> {
  const response = await fetch(`${API_ORIGIN}/api/v1/auth/session`, {
    method: 'GET',
    credentials: 'include',
    headers: { accept: 'application/json' },
  });
  return response.ok;
}

async function send(path: string, body: unknown): Promise<void> {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await readError(response);
  }
}

async function readError(response: Response): Promise<AuthRequestError> {
  const body: unknown = await response.json().catch(() => null);
  const error = isRecord(body) ? body.error : undefined;
  const code = isRecord(error) && typeof error.code === 'string' ? error.code : 'REQUEST_FAILED';
  return new AuthRequestError(response.status, code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
