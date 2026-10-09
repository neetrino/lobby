import { afterEach, describe, expect, it, vi } from 'vitest';

import { readDirectMessages, readNewerMessages, type DirectMessage } from './team-api';
import { isNearBottom, mergeNewest, nextScrollTop, TEAM_CHAT_POLL_MS, watchLatest } from './team-live';

vi.mock('./team-api', () => ({
  readDirectMessages: vi.fn(),
  readNewerMessages: vi.fn(),
}));

function message(id: string, createdAt: string): DirectMessage {
  return {
    id,
    body: id,
    createdAt,
    authorUserId: '00000000-0000-4000-8000-000000000001',
    authorName: 'Ada',
  };
}

describe('team chat live merge', () => {
  it('appends only messages the thread does not already show', () => {
    const older = message('00000000-0000-4000-8000-000000000010', '2026-10-08T08:00:00.000Z');
    const kept = message('00000000-0000-4000-8000-000000000011', '2026-10-08T08:01:00.000Z');
    const added = message('00000000-0000-4000-8000-000000000012', '2026-10-08T08:02:00.000Z');
    const current = [older, kept];

    expect(mergeNewest(current, [kept, added])).toEqual([older, kept, added]);
    expect(mergeNewest(current, [kept])).toBe(current);
  });

  it('restores the viewport by the height inserted above it', () => {
    expect(nextScrollTop({ height: 800, top: 120 }, 1100)).toBe(420);
    expect(isNearBottom(1000, 900, 80)).toBe(true);
    expect(isNearBottom(1000, 700, 80)).toBe(false);
  });

  it('follows every newer page instead of replacing the thread with the latest page', async () => {
    vi.useFakeTimers();
    const tip = message('00000000-0000-4000-8000-000000000010', '2026-10-08T08:00:00.000Z');
    const first = page([tip], null, 'sync-tip');
    const middle = message('00000000-0000-4000-8000-000000000011', '2026-10-08T08:01:00.000Z');
    const last = message('00000000-0000-4000-8000-000000000012', '2026-10-08T08:02:00.000Z');
    vi.mocked(readDirectMessages).mockResolvedValue(first);
    vi.mocked(readNewerMessages)
      .mockResolvedValueOnce(page([middle], 'page-2', 'sync-2'))
      .mockResolvedValueOnce(page([last], null, 'sync-3'));
    const onLatest = vi.fn();
    const stop = watchLatest('member', new AbortController().signal, {
      onOpen: vi.fn(),
      onLatest,
      onFail: vi.fn(),
    });

    await vi.waitFor(() => expect(readDirectMessages).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(TEAM_CHAT_POLL_MS);

    expect(readNewerMessages).toHaveBeenNthCalledWith(1, 'member', 'sync-tip', expect.any(AbortSignal));
    expect(readNewerMessages).toHaveBeenNthCalledWith(2, 'member', 'page-2', expect.any(AbortSignal));
    expect(onLatest).toHaveBeenCalledWith([middle, last]);
    stop();
  });

  it('retries the first load on the poll interval', async () => {
    vi.useFakeTimers();
    const first = page([message('00000000-0000-4000-8000-000000000010', '2026-10-08T08:00:00.000Z')]);
    vi.mocked(readDirectMessages).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(first);
    const onOpen = vi.fn();
    const onFail = vi.fn();
    const stop = watchLatest('member', new AbortController().signal, {
      onOpen,
      onLatest: vi.fn(),
      onFail,
    });

    await vi.waitFor(() => expect(onFail).toHaveBeenCalledTimes(1));
    expect(onOpen).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(TEAM_CHAT_POLL_MS);
    await vi.waitFor(() => expect(onOpen).toHaveBeenCalledWith(first));
    stop();
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

function page(
  data: DirectMessage[],
  nextCursor: string | null = null,
  syncCursor: string | null = null,
): { data: DirectMessage[]; page: { nextCursor: string | null; syncCursor: string | null } } {
  return { data, page: { nextCursor, syncCursor } };
}
