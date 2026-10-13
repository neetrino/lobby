/** Injection token for the normalized origin allowlist. */
export const ALLOWED_ORIGINS = Symbol('ALLOWED_ORIGINS');

/**
 * Reads `ALLOWED_ORIGINS` (comma-separated). When it is unset, `APP_URL` is the only origin.
 * An empty result fail-closes mutating requests. `*` is rejected at startup.
 */
export function readAllowedOrigins(env: NodeJS.ProcessEnv = process.env): readonly string[] {
  const configured = env.ALLOWED_ORIGINS?.trim() ?? '';
  const entries = configured.length > 0 ? configured.split(',') : [env.APP_URL ?? ''];
  const origins = new Set<string>();

  for (const entry of entries) {
    const trimmed = entry.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const origin = parseAllowedOrigin(trimmed);
    if (origin === null) {
      throw new Error('ALLOWED_ORIGINS contains an invalid origin.');
    }
    origins.add(origin);
  }

  return [...origins];
}

function parseAllowedOrigin(value: string): string | null {
  if (value.includes('*')) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.origin === 'null' ? null : url.origin;
  } catch {
    return null;
  }
}
