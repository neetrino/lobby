import { describe, expect, it } from 'vitest';

import {
  assertProductionInvitationEmailConfig,
  RESEND_REQUEST_TIMEOUT_MS,
  ResendEmailProvider,
} from './email-provider.js';

const message = {
  to: 'member@example.com',
  organizationName: 'Acme',
  inviterName: 'Anna',
  invitationUrl: 'http://localhost:3000/en/invitations/accept?id=1&token=secret',
  locale: 'en' as const,
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
};

describe('ResendEmailProvider', () => {
  it('sends the outbox event id as the idempotency key and aborts a hung request', async () => {
    let timed = false;
    const provider = new ResendEmailProvider('re_test', 'test@example.com', async (_url, init) => {
      timed = init?.signal instanceof AbortSignal && init.signal.aborted === false;
      return new Response('{}', { status: 200 });
    });

    await provider.sendMemberInvitation(message);

    expect(timed).toBe(true);
    expect(RESEND_REQUEST_TIMEOUT_MS).toBe(10_000);
  });

  it('puts the idempotency key on the request and not in an error', async () => {
    const provider = new ResendEmailProvider('re_test', 'test@example.com', async (_url, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('idempotency-key')).toBe(message.idempotencyKey);
      return new Response('no', { status: 500 });
    });

    await expect(provider.sendMemberInvitation(message)).rejects.toThrow(
      'Email provider rejected the invitation.',
    );
  });
});

describe('assertProductionInvitationEmailConfig', () => {
  it('starts outside production when email delivery is unconfigured', () => {
    expect(() => assertProductionInvitationEmailConfig({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('refuses to start in production when delivery configuration is missing', () => {
    expect(() => assertProductionInvitationEmailConfig({ NODE_ENV: 'production' })).toThrow(
      'Invitation email configuration is incomplete: RESEND_API_KEY, RESEND_FROM_EMAIL, APP_URL, INVITATION_TOKEN_KEY.',
    );
  });
});
