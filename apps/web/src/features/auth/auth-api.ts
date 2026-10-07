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

export type RegistrationStatus = 'enabled' | 'disabled' | 'unavailable';

/** Maps the public registration switch. A missing value stays unavailable. */
export function toRegistrationStatus(enabled: boolean | undefined): RegistrationStatus {
  if (enabled === true) {
    return 'enabled';
  }
  if (enabled === false) {
    return 'disabled';
  }
  return 'unavailable';
}

/** Reads whether public registration is open. A failed read is `unavailable`. */
export async function readRegistrationStatus(): Promise<RegistrationStatus> {
  try {
    const response = await fetch(`${API_ORIGIN}/api/v1/auth/registration`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      return 'unavailable';
    }
    const body: unknown = await response.json();
    const data = isRecord(body) ? body.data : undefined;
    const enabled = isRecord(data) && typeof data.enabled === 'boolean' ? data.enabled : undefined;
    return toRegistrationStatus(enabled);
  } catch {
    return 'unavailable';
  }
}

export function logoutAccount(): Promise<void> {
  return send('/api/v1/auth/logout', undefined, true);
}

export function requestPasswordReset(input: {
  workspace: string;
  email: string;
  locale: string;
}): Promise<void> {
  return send('/api/v1/auth/password-resets', {
    subdomain: input.workspace.trim().toLowerCase(),
    email: input.email.trim().toLowerCase(),
    locale: input.locale,
  });
}

export function confirmPasswordReset(input: { token: string; password: string }): Promise<void> {
  return send('/api/v1/auth/password-resets/confirm', {
    token: input.token,
    password: input.password,
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

/** Where a signed-in account should land. A customer session stays on the dashboard. */
export async function homeAfterSignIn(): Promise<'platform' | 'dashboard'> {
  const response = await fetch(`${API_ORIGIN}/api/v1/auth/session`, {
    method: 'GET',
    credentials: 'include',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    return 'dashboard';
  }
  const body: unknown = await response.json().catch(() => null);
  const data = isRecord(body) ? body.data : undefined;
  return isRecord(data) && data.platform === true ? 'platform' : 'dashboard';
}

async function send(path: string, body: unknown, empty = false): Promise<void> {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: empty
      ? { accept: 'application/json' }
      : { accept: 'application/json', 'content-type': 'application/json' },
    body: empty ? undefined : JSON.stringify(body),
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
