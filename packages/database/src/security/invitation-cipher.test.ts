import { describe, expect, it } from 'vitest';

import {
  createInvitationSecret,
  invitationTokenMatches,
  openInvitationToken,
  readInvitationTokenKey,
  sealInvitationToken,
} from './invitation-cipher';

const key = Buffer.alloc(32, 7);

describe('invitation cipher', () => {
  it('stores a hash and round-trips the sealed token', () => {
    const secret = createInvitationSecret();
    const sealed = sealInvitationToken(secret.token, key);

    expect(sealed).not.toContain(secret.token);
    expect(invitationTokenMatches(secret.token, secret.tokenHash)).toBe(true);
    expect(invitationTokenMatches('other-token-value', secret.tokenHash)).toBe(false);
    expect(invitationTokenMatches(secret.token, null)).toBe(false);
    expect(openInvitationToken(sealed, key)).toBe(secret.token);
  });

  it('rejects a key that is not 32 bytes', () => {
    expect(() => readInvitationTokenKey({ INVITATION_TOKEN_KEY: 'aa' })).toThrow(
      'INVITATION_TOKEN_KEY must be 32 bytes',
    );
    expect(readInvitationTokenKey({})).toBeNull();
  });
});
