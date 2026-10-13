import { describe, expect, it } from 'vitest';

import { sanitizeChanges, toAuditListItem } from './audit-event-view';

const row = {
  id: '10000000-0000-4000-8000-000000000001',
  occurredAt: new Date('2026-01-01T00:00:00.000Z'),
  actorUserId: '20000000-0000-4000-8000-000000000002',
  actorName: null as string | null,
  actorRole: 'OWNER' as const,
  actorType: 'USER' as const,
  action: 'user.sessions.terminated',
  resourceType: 'user',
  resourceId: '20000000-0000-4000-8000-000000000002',
  outcome: 'DENIED',
  reason: null,
  actor: null as { name: string } | null,
};

describe('audit event view', () => {
  it('keeps the stored actor name when the live user was renamed', () => {
    const item = toAuditListItem({ ...row, actorName: 'Ada', actor: { name: 'Renamed' } }, 'Ada');
    expect(item.actor.name).toBe('Ada');
  });

  it('labels a missing actor as a former user', () => {
    expect(toAuditListItem(row, null).actor.name).toBe('Former user');
  });

  it('removes passwords, tokens, and session ids from changes', () => {
    expect(
      sanitizeChanges({
        authenticationVersion: { from: 1, to: 2 },
        password: 'secret',
        invitationToken: 'raw',
        sessionId: 'sid',
        requestBody: { email: 'a@b.c' },
      }),
    ).toEqual({ authenticationVersion: { from: 1, to: 2 } });
  });
});
