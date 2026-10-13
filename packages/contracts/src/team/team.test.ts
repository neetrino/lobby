import { describe, expect, it } from 'vitest';

import { directMessagePageSchema, teamDirectoryResponseSchema } from './team.js';

describe('team contracts', () => {
  it('accepts a directory and a message page', () => {
    const directory = teamDirectoryResponseSchema.parse({
      data: {
        organization: { name: 'Acme' },
        members: [
          {
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Ada',
            email: 'ada@example.com',
            role: 'OWNER',
            jobTitle: null,
          },
        ],
      },
    });
    const page = directMessagePageSchema.parse({
      data: [
        {
          id: '00000000-0000-4000-8000-000000000002',
          authorUserId: '00000000-0000-4000-8000-000000000001',
          authorName: 'Ada',
          body: 'Hello',
          createdAt: '2026-10-08T08:00:00.000Z',
        },
      ],
      page: { nextCursor: null, syncCursor: 'opaque-tip' },
    });

    expect(directory.data.members[0]?.jobTitle).toBeNull();
    expect(page.page.nextCursor).toBeNull();
    expect(page.page.syncCursor).toBe('opaque-tip');
  });
});
