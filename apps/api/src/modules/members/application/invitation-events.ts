import { randomUUID } from 'node:crypto';
import {
  INVITATION_CREATED_EVENT_VERSION,
  invitationCreatedEventSchema,
  type InvitationCreatedEvent,
  type Locale,
} from '@lobby/contracts';

export type InvitationDelivery = {
  invitationId: string;
  tenantId: string;
  recipientEmail: string;
  locale: Locale;
  organizationName: string;
  inviterName: string;
  tokenCiphertext: string;
};

/** Outbox event for one invitation email. The ciphertext is not the raw token. */
export function invitationCreatedEvent(input: InvitationDelivery): InvitationCreatedEvent {
  return invitationCreatedEventSchema.parse({
    eventId: randomUUID(),
    eventType: 'invitation.created',
    eventVersion: INVITATION_CREATED_EVENT_VERSION,
    tenantId: input.tenantId,
    aggregateType: 'memberInvitation',
    aggregateId: input.invitationId,
    occurredAt: new Date().toISOString(),
    payload: {
      recipientEmail: input.recipientEmail,
      invitationId: input.invitationId,
      locale: input.locale,
      organizationName: input.organizationName,
      inviterName: input.inviterName,
      tokenCiphertext: input.tokenCiphertext,
    },
  });
}
