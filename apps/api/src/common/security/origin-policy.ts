const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

type HeaderValue = string | readonly string[] | undefined;

export type OriginHeaders = {
  origin?: HeaderValue;
  referer?: HeaderValue;
};

/**
 * Mutating requests must present an allowed Origin.
 * A missing Origin may fall back to the Referer origin. A present Origin never falls through.
 * Missing both is rejected. SameSite and CORS do not satisfy this check.
 */
export function isOriginAllowed(method: string, headers: OriginHeaders, allowed: ReadonlySet<string>): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) {
    return true;
  }

  const origin = readOrigin(headers.origin);
  if (origin.status === 'invalid') {
    return false;
  }
  if (origin.status === 'present') {
    return allowed.has(origin.value);
  }

  const referer = originFromReferer(headers.referer);
  return referer !== null && allowed.has(referer);
}

function readOrigin(value: HeaderValue): { status: 'absent' } | { status: 'invalid' } | { status: 'present'; value: string } {
  if (value === undefined) {
    return { status: 'absent' };
  }
  if (typeof value !== 'string') {
    return { status: 'invalid' };
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { status: 'absent' };
  }

  const origin = parseOrigin(trimmed);
  return origin === null ? { status: 'invalid' } : { status: 'present', value: origin };
}

function parseOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.origin === 'null' || url.pathname !== '/' || url.search !== '' || url.hash !== '') {
      return null;
    }
    return value === url.origin ? url.origin : null;
  } catch {
    return null;
  }
}

function originFromReferer(value: HeaderValue): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return url.origin === 'null' ? null : url.origin;
  } catch {
    return null;
  }
}
