import { describe, expect, it } from 'vitest';

import { decodeCursor } from '../../../common/pagination';
import { newerThan, toForwardPage } from './direct-message-page';

const memberId = '00000000-0000-4000-8000-000000000020';

describe('forward message page', () => {
  it('keeps the oldest rows and points the next cursor at the newest visible row', () => {
    const page = toForwardPage(
      [
        row('00000000-0000-4000-8000-000000000003', 'm3', '2026-01-01T00:00:02.000Z'),
        row('00000000-0000-4000-8000-000000000004', 'm4', '2026-01-01T00:00:03.000Z'),
        row('00000000-0000-4000-8000-000000000005', 'm5', '2026-01-01T00:00:04.000Z'),
      ],
      2,
      memberId,
    );

    expect(page.data.map((message) => message.body)).toEqual(['m3', 'm4']);
    expect(page.page.syncCursor).toBe(page.page.nextCursor);
    expect(decodeCursor(page.page.syncCursor ?? '')).toEqual({
      createdAt: '2026-01-01T00:00:03.000Z',
      id: '00000000-0000-4000-8000-000000000004',
      memberId,
    });
  });

  it('keeps the sync cursor when there is no newer page', () => {
    const page = toForwardPage(
      [row('00000000-0000-4000-8000-000000000005', 'm5', '2026-01-01T00:00:04.000Z')],
      2,
      memberId,
    );

    expect(page.page.nextCursor).toBeNull();
    expect(decodeCursor(page.page.syncCursor ?? '')).toMatchObject({
      id: '00000000-0000-4000-8000-000000000005',
    });
  });

  it('treats an equal timestamp with a greater id as newer', () => {
    const createdAt = '2026-01-01T00:00:00.000Z';
    const id = '00000000-0000-4000-8000-000000000004';

    expect(newerThan({ createdAt, id, memberId })).toEqual({
      OR: [{ createdAt: { gt: new Date(createdAt) } }, { createdAt: new Date(createdAt), id: { gt: id } }],
    });
  });
});

function row(id: string, body: string, iso: string) {
  return {
    id,
    authorUserId: '00000000-0000-4000-8000-000000000001',
    body,
    createdAt: new Date(iso),
    author: { name: 'Ada' },
  };
}
