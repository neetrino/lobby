import { z } from 'zod';

import { sessionRoles, type StoredSession } from '../domain/authenticated-session';

const INVALID_SESSION_SUBJECT = 'Invalid session subject.';

const createSessionInputSchema = z.strictObject({
  userId: z.uuid(),
  tenantId: z.uuid(),
  role: z.enum(sessionRoles),
  authenticationVersion: z.number().int().min(1),
});

export type CreateSessionInput = z.infer<typeof createSessionInputSchema>;

const storedSessionSchema = z.strictObject({
  userId: z.uuid(),
  tenantId: z.uuid(),
  role: z.enum(sessionRoles),
  authenticationVersion: z.number().int().min(1),
  createdAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime(),
  idleExpiresAt: z.iso.datetime(),
  absoluteExpiresAt: z.iso.datetime(),
});

const userIdCarrierSchema = z.object({
  userId: z.uuid(),
});

export function parseCreateSessionInput(input: unknown): CreateSessionInput {
  const result = createSessionInputSchema.safeParse(input);
  if (!result.success) {
    throw new Error(INVALID_SESSION_SUBJECT);
  }

  return result.data;
}

export function serializeStoredSession(session: StoredSession): string {
  return JSON.stringify({
    userId: session.userId,
    tenantId: session.tenantId,
    role: session.role,
    authenticationVersion: session.authenticationVersion,
    createdAt: session.createdAt.toISOString(),
    lastSeenAt: session.lastSeenAt.toISOString(),
    idleExpiresAt: session.idleExpiresAt.toISOString(),
    absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
  });
}

/** Returns null when the payload is missing, malformed, or idle exceeds absolute. */
export function parseStoredSession(payload: string, sessionIdHash: string): StoredSession | null {
  const raw = parseJson(payload);
  const parsed = storedSessionSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  const idleExpiresAt = new Date(parsed.data.idleExpiresAt);
  const absoluteExpiresAt = new Date(parsed.data.absoluteExpiresAt);
  if (idleExpiresAt.getTime() > absoluteExpiresAt.getTime()) {
    return null;
  }

  return {
    sessionIdHash,
    userId: parsed.data.userId,
    tenantId: parsed.data.tenantId,
    role: parsed.data.role,
    authenticationVersion: parsed.data.authenticationVersion,
    createdAt: new Date(parsed.data.createdAt),
    lastSeenAt: new Date(parsed.data.lastSeenAt),
    idleExpiresAt,
    absoluteExpiresAt,
  };
}

export function readStoredUserId(payload: string): string | null {
  const raw = parseJson(payload);
  const parsed = userIdCarrierSchema.safeParse(raw);
  return parsed.success ? parsed.data.userId : null;
}

function parseJson(payload: string): unknown {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return null;
  }
}
