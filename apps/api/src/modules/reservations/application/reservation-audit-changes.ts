import type { ReservationLifecycleChanges } from '@lobby/contracts';

import type { ReservationRecord } from '../infrastructure/reservation.repository';

type ChangeBody = Exclude<ReservationLifecycleChanges, null>;

/** Non-PII diff for a reservation edit or a status change. */
export function reservationAuditChanges(
  before: ReservationRecord,
  after: ReservationRecord,
): ReservationLifecycleChanges {
  const changes: ChangeBody = {};
  if (before.status !== after.status) {
    changes.status = { from: before.status, to: after.status };
  }
  if (before.startsAt.getTime() !== after.startsAt.getTime()) {
    changes.startsAt = { from: before.startsAt.toISOString(), to: after.startsAt.toISOString() };
  }
  if (before.guestCount !== after.guestCount) {
    changes.guestCount = { from: before.guestCount, to: after.guestCount };
  }
  if (before.locationId !== after.locationId) changes.locationChanged = true;
  if (before.tableId !== after.tableId) changes.tableChanged = true;
  if (before.assignedUserId !== after.assignedUserId) changes.assigneeChanged = true;
  if (before.contactId !== after.contactId) changes.contactChanged = true;
  if (guestDetailsChanged(before, after)) changes.guestDetailsChanged = true;
  return Object.keys(changes).length === 0 ? null : changes;
}

function guestDetailsChanged(before: ReservationRecord, after: ReservationRecord): boolean {
  return (
    before.customerName !== after.customerName ||
    before.customerPhone !== after.customerPhone ||
    before.customerEmail !== after.customerEmail ||
    before.customerNote !== after.customerNote
  );
}
