import { createInvitationSecret, sealInvitationToken } from '@lobby/database';
import { describe, expect, it } from 'vitest';

import type { EmailProvider, PasswordResetEmail } from '../email/email-provider.js';
import { PasswordResetEmailHandler } from './password-reset-email.handler.js';

const key = Buffer.alloc(32, 9);

describe('PasswordResetEmailHandler', () => {
  it('sends the reset link and does not keep the raw token in a failure', async () => {
    const secret = createInvitationSecret();
    const sent: PasswordResetEmail[] = [];
    const email: EmailProvider = {
      sendMemberInvitation() {
        return Promise.resolve();
      },
      sendPasswordReset(input) {
        sent.push(input);
        return Promise.resolve();
      },
    };
    const handler = new PasswordResetEmailHandler(email, key, 'http://localhost:3000');

    await handler.handle(event(sealInvitationToken(secret.token, key)));

    expect(sent).toHaveLength(1);
    expect(sent[0]?.resetUrl).toContain(secret.token);
    expect(sent[0]?.resetUrl.startsWith('http://localhost:3000/en/reset-password?')).toBe(true);
    await expect(handler.handle(event('not-a-seal'))).rejects.toThrow(
      'Password reset token seal is invalid.',
    );
  });
});

function event(tokenCiphertext: string) {
  return {
    eventId: '11111111-1111-4111-8111-111111111111',
    eventType: 'password_reset.requested' as const,
    eventVersion: 1 as const,
    tenantId: '22222222-2222-4222-8222-222222222222',
    aggregateType: 'passwordReset' as const,
    aggregateId: '33333333-3333-4333-8333-333333333333',
    occurredAt: '2026-10-05T08:00:00.000Z',
    payload: {
      recipientEmail: 'ada@example.com',
      resetId: '33333333-3333-4333-8333-333333333333',
      locale: 'en' as const,
      organizationName: 'Acme',
      tokenCiphertext,
    },
  };
}
