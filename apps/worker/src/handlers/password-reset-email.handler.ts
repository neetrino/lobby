import type { PasswordResetRequestedEvent } from '@lobby/contracts';
import { openInvitationToken } from '@lobby/database';

import { PermanentDispatchError } from '../dispatch/retry-classification.js';
import type { EmailProvider } from '../email/email-provider.js';

/** Sends one password-reset email. A missing provider or key fails without logging the payload. */
export class PasswordResetEmailHandler {
  constructor(
    private readonly email: EmailProvider | null,
    private readonly tokenKey: Buffer | null,
    private readonly appUrl: string,
  ) {}

  async handle(event: PasswordResetRequestedEvent): Promise<void> {
    if (this.email === null) {
      throw new PermanentDispatchError('Email provider is not configured.');
    }
    if (this.tokenKey === null) {
      throw new PermanentDispatchError('Invitation token key is not configured.');
    }
    if (this.appUrl.length === 0) {
      throw new PermanentDispatchError('APP_URL is not configured.');
    }
    const token = openResetToken(event.payload.tokenCiphertext, this.tokenKey);
    await this.email.sendPasswordReset({
      to: event.payload.recipientEmail,
      organizationName: event.payload.organizationName,
      resetUrl: resetLink(this.appUrl, event.payload.locale, token),
      locale: event.payload.locale,
      idempotencyKey: event.eventId,
    });
  }
}

function openResetToken(sealed: string, key: Buffer): string {
  try {
    return openInvitationToken(sealed, key);
  } catch {
    throw new PermanentDispatchError('Password reset token seal is invalid.');
  }
}

function resetLink(appUrl: string, locale: string, token: string): string {
  const base = appUrl.replace(/\/$/, '');
  const query = new URLSearchParams({ token });
  return `${base}/${locale}/reset-password?${query.toString()}`;
}
