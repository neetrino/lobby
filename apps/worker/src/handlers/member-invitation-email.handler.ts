import type { InvitationCreatedEvent } from '@lobby/contracts';
import { openInvitationToken } from '@lobby/database';

import { PermanentDispatchError } from '../dispatch/retry-classification.js';
import type { EmailProvider } from '../email/email-provider.js';

/** Sends one invitation email. A missing provider or key fails without logging the payload. */
export class MemberInvitationEmailHandler {
  constructor(
    private readonly email: EmailProvider | null,
    private readonly tokenKey: Buffer | null,
    private readonly appUrl: string,
  ) {}

  async handle(event: InvitationCreatedEvent): Promise<void> {
    if (this.email === null) {
      throw new PermanentDispatchError('Email provider is not configured.');
    }
    if (this.tokenKey === null) {
      throw new PermanentDispatchError('Invitation token key is not configured.');
    }
    if (this.appUrl.length === 0) {
      throw new PermanentDispatchError('APP_URL is not configured.');
    }
    let token: string;
    try {
      token = openInvitationToken(event.payload.tokenCiphertext, this.tokenKey);
    } catch {
      throw new PermanentDispatchError('Invitation token seal is invalid.');
    }
    const invitationUrl = invitationLink(this.appUrl, event.payload.locale, event.aggregateId, token);
    await this.email.sendMemberInvitation({
      to: event.payload.recipientEmail,
      organizationName: event.payload.organizationName,
      inviterName: event.payload.inviterName,
      invitationUrl,
      locale: event.payload.locale,
    });
  }
}

function invitationLink(appUrl: string, locale: string, invitationId: string, token: string): string {
  const base = appUrl.replace(/\/$/, '');
  const query = new URLSearchParams({ id: invitationId, token });
  return `${base}/${locale}/invitations/accept?${query.toString()}`;
}
