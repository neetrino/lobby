import { describe, expect, it } from 'vitest';

import type { UserRole } from '../../../common/tenant/request-context';
import { canRevokeUserSessions } from './session-revocation';

const actorId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const tenantId = '33333333-3333-4333-8333-333333333333';

function actor(role: UserRole) {
  return { userId: actorId, tenantId, role };
}

describe('canRevokeUserSessions', () => {
  it('lets every role revoke itself', () => {
    for (const role of ['OWNER', 'ADMIN', 'MEMBER'] as const) {
      expect(canRevokeUserSessions(actor(role), actorId)).toBe(true);
    }
  });

  it('lets owner and admin revoke someone else and refuses a member', () => {
    expect(canRevokeUserSessions(actor('OWNER'), otherId)).toBe(true);
    expect(canRevokeUserSessions(actor('ADMIN'), otherId)).toBe(true);
    expect(canRevokeUserSessions(actor('MEMBER'), otherId)).toBe(false);
  });
});
