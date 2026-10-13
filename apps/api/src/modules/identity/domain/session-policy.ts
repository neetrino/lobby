const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR * MS_PER_SECOND;
const IDLE_TTL_DAYS = 7;
const ABSOLUTE_TTL_DAYS = 30;

/** Sliding inactivity limit. */
export const SESSION_IDLE_TTL_MS = IDLE_TTL_DAYS * HOURS_PER_DAY * MS_PER_HOUR;

/** Hard session lifetime. Touch must not move this instant. */
export const SESSION_ABSOLUTE_TTL_MS = ABSOLUTE_TTL_DAYS * HOURS_PER_DAY * MS_PER_HOUR;

/** Sliding expiry is persisted at most once per hour. */
export const SESSION_REFRESH_INTERVAL_MS = MS_PER_HOUR;

export type SessionLifetime = {
  lastSeenAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
};

export function isExpired(
  session: Pick<SessionLifetime, 'idleExpiresAt' | 'absoluteExpiresAt'>,
  now: Date,
): boolean {
  const time = now.getTime();
  return time >= session.idleExpiresAt.getTime() || time >= session.absoluteExpiresAt.getTime();
}

export function shouldRefresh(session: SessionLifetime, now: Date): boolean {
  if (isExpired(session, now)) {
    return false;
  }

  return now.getTime() - session.lastSeenAt.getTime() >= SESSION_REFRESH_INTERVAL_MS;
}

/** Next idle deadline. Never later than the absolute deadline. */
export function nextIdleExpiresAt(now: Date, absoluteExpiresAt: Date): Date {
  const proposedIdleExpiresAt = now.getTime() + SESSION_IDLE_TTL_MS;
  return new Date(Math.min(proposedIdleExpiresAt, absoluteExpiresAt.getTime()));
}

export function createSessionLifetime(now: Date): SessionLifetime & { createdAt: Date } {
  const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_TTL_MS);
  return {
    createdAt: now,
    lastSeenAt: now,
    idleExpiresAt: nextIdleExpiresAt(now, absoluteExpiresAt),
    absoluteExpiresAt,
  };
}
