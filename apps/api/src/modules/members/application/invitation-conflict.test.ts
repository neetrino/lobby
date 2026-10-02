import { describe, expect, it } from 'vitest';

import { InvitationError } from '../domain/invitation.errors';
import { invitationUniqueConflict, rethrowInvitationConflict } from './invitation-conflict';

describe('invitation unique conflicts', () => {
  it('maps an open invitation and an existing member to catalogued errors', () => {
    expect(invitationUniqueConflict(prisma7('member_invitations_open_email_key'))).toBe(
      'INVITATION_ALREADY_PENDING',
    );
    expect(invitationUniqueConflict(prisma7('users_tenant_id_email_key', 'users'))).toBe(
      'INVITATION_EMAIL_TAKEN',
    );
    expect(invitationUniqueConflict(prisma7('member_invitations_token_hash_key'))).toBe(
      'INVITATION_INVALID',
    );
    expect(invitationUniqueConflict({ code: 'P2002', meta: { target: 'other' } })).toBeNull();
  });

  it('replaces only a recognized unique violation', () => {
    expect(() => rethrowInvitationConflict(prisma7('member_invitations_open_email_key'))).toThrow(
      InvitationError,
    );
    expect(() => rethrowInvitationConflict(new Error('database down'))).toThrow('database down');
  });
});

function prisma7(index: string, table = 'member_invitations'): { code: 'P2002'; meta: unknown } {
  return {
    code: 'P2002',
    meta: {
      driverAdapterError: {
        cause: {
          constraint: { index },
          table,
        },
      },
    },
  };
}
