import { randomUUID } from 'node:crypto';
import {
  PASSWORD_RESET_REQUESTED_EVENT_VERSION,
  passwordResetRequestedEventSchema,
  type Locale,
  type PasswordResetRequestedEvent,
} from '@lobby/contracts';

export type PasswordResetDelivery = {
  resetId: string;
  tenantId: string;
  recipientEmail: string;
  locale: Locale;
  organizationName: string;
  tokenCiphertext: string;
};

/** Outbox event for one reset email. The ciphertext is not the raw token. */
export function passwordResetRequestedEvent(input: PasswordResetDelivery): PasswordResetRequestedEvent {
  return passwordResetRequestedEventSchema.parse({
    eventId: randomUUID(),
    eventType: 'password_reset.requested',
    eventVersion: PASSWORD_RESET_REQUESTED_EVENT_VERSION,
    tenantId: input.tenantId,
    aggregateType: 'passwordReset',
    aggregateId: input.resetId,
    occurredAt: new Date().toISOString(),
    payload: {
      recipientEmail: input.recipientEmail,
      resetId: input.resetId,
      locale: input.locale,
      organizationName: input.organizationName,
      tokenCiphertext: input.tokenCiphertext,
    },
  });
}
