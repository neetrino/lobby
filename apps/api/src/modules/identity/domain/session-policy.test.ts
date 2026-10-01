import { describe, expect, it } from 'vitest';

import {
  isExpired,
  nextIdleExpiresAt,
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_IDLE_TTL_MS,
  SESSION_REFRESH_INTERVAL_MS,
  shouldRefresh,
  createSessionLifetime,
} from './session-policy';

const now = new Date('2026-09-28T10:00:00.000Z');

describe('session policy', () => {
  it('expires at the idle deadline and at the absolute deadline', () => {
    const lifetime = createSessionLifetime(now);

    expect(isExpired(lifetime, new Date(lifetime.idleExpiresAt.getTime() - 1))).toBe(false);
    expect(isExpired(lifetime, lifetime.idleExpiresAt)).toBe(true);
    expect(lifetime.absoluteExpiresAt.getTime() - lifetime.createdAt.getTime()).toBe(
      SESSION_ABSOLUTE_TTL_MS,
    );
    expect(lifetime.idleExpiresAt.getTime() - now.getTime()).toBe(SESSION_IDLE_TTL_MS);
  });

  it('refreshes only after the interval and never when expired', () => {
    const lifetime = createSessionLifetime(now);
    const beforeInterval = new Date(now.getTime() + SESSION_REFRESH_INTERVAL_MS - 1);
    const atInterval = new Date(now.getTime() + SESSION_REFRESH_INTERVAL_MS);

    expect(shouldRefresh(lifetime, beforeInterval)).toBe(false);
    expect(shouldRefresh(lifetime, atInterval)).toBe(true);
    expect(shouldRefresh(lifetime, lifetime.idleExpiresAt)).toBe(false);
  });

  it('caps the next idle deadline at the absolute deadline', () => {
    const absoluteExpiresAt = new Date(now.getTime() + SESSION_REFRESH_INTERVAL_MS);

    expect(nextIdleExpiresAt(now, absoluteExpiresAt)).toEqual(absoluteExpiresAt);
    expect(
      nextIdleExpiresAt(now, new Date(now.getTime() + SESSION_IDLE_TTL_MS + 1)).getTime(),
    ).toBe(now.getTime() + SESSION_IDLE_TTL_MS);
  });
});
