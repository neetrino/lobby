import { createHash } from 'node:crypto';
import type { CreateReservationCommand } from '@lobby/contracts';

import type { ReservationPeriod } from './reservation-rules';

const FINGERPRINT_VERSION = '1';

/**
 * SHA-256 of the original booking command.
 * The payload is a fixed-order JSON array, so a separator inside one value cannot join two fields.
 * Omitted optional values are null. Phone, email, and notes stay inside the hash.
 */
export function requestFingerprint(command: CreateReservationCommand, period: ReservationPeriod): string {
  const canonical = JSON.stringify([
    FINGERPRINT_VERSION,
    command.locationId,
    command.requestedTableId,
    command.customer.contactId ?? null,
    command.assignedUserId ?? null,
    command.source.type,
    command.source.accountId ?? null,
    command.source.externalRequestId ?? null,
    command.source.conversationId ?? null,
    command.source.messageId ?? null,
    command.guestCount,
    period.startsAt.toISOString(),
    period.endsAt.toISOString(),
    command.customer.name,
    command.customer.phone ?? null,
    command.customer.email ?? null,
    command.customerNote ?? null,
  ]);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
