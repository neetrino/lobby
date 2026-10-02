/**
 * Opaque cursor transport.
 * The caller validates the decoded value with that endpoint's own schema.
 */
export function encodeCursor(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/** Returns `undefined` when the value is not cursor JSON. */
export function decodeCursor(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
  } catch {
    return undefined;
  }
}
