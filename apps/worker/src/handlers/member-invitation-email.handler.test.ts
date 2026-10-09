import { createInvitationSecret, sealInvitationToken } from '@lobby/database';
import { describe, expect, it } from 'vitest';

import type { EmailProvider, MemberInvitationEmail } from '../email/email-provider.js';
import { MemberInvitationEmailHandler } from './member-invitation-email.handler.js';

const key = Buffer.alloc(32, 9);

describe('MemberInvitationEmailHandler', () => {
  it('sends the accept link and does not put the raw token in a failure', async () => {
    const secret = createInvitationSecret();
    const sent: MemberInvitationEmail[] = [];
    const email: EmailProvider = {
      sendMemberInvitation(input) {
        sent.push(input);
        return Promise.resolve();
      },
      sendPasswordReset() {
        return Promise.resolve();
      },
    };
    const handler = new MemberInvitationEmailHandler(email, key, 'http://localhost:3000');

    await handler.handle(event(sealInvitationToken(secret.token, key)));

    expect(sent).toHaveLength(1);
    expect(sent[0]?.idempotencyKey).toBe('11111111-1111-4111-8111-111111111111');
    expect(sent[0]?.invitationUrl).toContain(secret.token);
    expect(sent[0]?.invitationUrl.startsWith('http://localhost:3000/hy/invitations/accept?')).toBe(
      true,
    );
    await expect(handler.handle(event('not-a-seal'))).rejects.toThrow(
      'Invitation token seal is invalid.',
    );
  });
});

function event(tokenCiphertext: string) {
  return {
    eventId: '11111111-1111-4111-8111-111111111111',
    eventType: 'invitation.created' as const,
    eventVersion: 1 as const,
    tenantId: '22222222-2222-4222-8222-222222222222',
    aggregateType: 'memberInvitation' as const,
    aggregateId: '33333333-3333-4333-8333-333333333333',
    occurredAt: '2026-10-02T12:00:00.000Z',
    payload: {
      recipientEmail: 'member@example.com',
      invitationId: '33333333-3333-4333-8333-333333333333',
      locale: 'hy' as const,
      organizationName: 'Acme',
      inviterName: 'Anna',
      tokenCiphertext,
    },
  };
}
