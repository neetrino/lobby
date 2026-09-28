export const sessionRoles = ['OWNER', 'ADMIN', 'MEMBER'] as const;

export type SessionRole = (typeof sessionRoles)[number];

/**
 * Session established from Redis, not from the client.
 * `sessionIdHash` is the Redis key digest. The raw session id is not part of this object.
 */
export type AuthenticatedSession = {
  sessionIdHash: string;
  userId: string;
  tenantId: string;
  role: SessionRole;
  authenticationVersion: number;
  createdAt: Date;
  lastSeenAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
};
