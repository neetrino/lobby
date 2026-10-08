import type { CreateReservationCommand } from '@lobby/contracts';

import { AuthorizationError } from '../../../common/auth/authorization';
import { ValidationError } from '../../../common/http/validation-error';
import { fitsOpenWindow, localMoment, previousLocalDate } from '../domain/reservation-hours';
import type { ReservationActor } from './reservation-actor';
import { ReservationFailure } from './reservation-errors';
import type { ReservationRecord, TenantReservations } from '../infrastructure/reservation.repository';

export type ReservationPeriod = { startsAt: Date; endsAt: Date };

const MINUTE_MS = 60_000;

export function reservationPeriod(command: CreateReservationCommand): ReservationPeriod {
  const startsAt = new Date(command.startsAt);
  return { startsAt, endsAt: new Date(startsAt.getTime() + command.durationMinutes * MINUTE_MS) };
}

export function assertActorSource(actor: ReservationActor, command: CreateReservationCommand): void {
  if (actor.type === 'USER') {
    return;
  }
  if (command.source.type !== actor.provider || command.source.accountId !== actor.channelAccountId) {
    throw new AuthorizationError();
  }
  if (command.source.externalRequestId === undefined) {
    throw new ValidationError([{ path: 'source.externalRequestId' }]);
  }
}

export async function assertBookable(
  scope: TenantReservations,
  command: CreateReservationCommand,
  period: ReservationPeriod,
  now: Date,
): Promise<void> {
  const location = await requireLocation(scope, command.locationId);
  if (period.startsAt.getTime() <= now.getTime()) {
    throw new ReservationFailure('RESERVATION_START_NOT_IN_FUTURE');
  }
  await requireOpen(scope, location, period);
  await requireContact(scope, command.customer.contactId);
  await requireTable(scope, command);
  await requireAssignee(scope, command.assignedUserId);
}

export function sameBooking(
  existing: ReservationRecord,
  command: CreateReservationCommand,
  period: ReservationPeriod,
): boolean {
  return (
    existing.locationId === command.locationId &&
    existing.tableId === command.requestedTableId &&
    existing.guestCount === command.guestCount &&
    existing.customerName === command.customer.name &&
    existing.startsAt.getTime() === period.startsAt.getTime() &&
    existing.endsAt.getTime() === period.endsAt.getTime()
  );
}

async function requireLocation(scope: TenantReservations, locationId: string) {
  const location = await scope.findLocation(locationId);
  if (location === null || location.status !== 'ACTIVE') {
    throw new ReservationFailure('RESERVATION_LOCATION_NOT_FOUND');
  }
  return location;
}

async function requireOpen(
  scope: TenantReservations,
  location: { id: string; timezone: string },
  period: ReservationPeriod,
): Promise<void> {
  const start = localMoment(period.startsAt, location.timezone);
  const yesterday = previousLocalDate(start.date);
  const windows = await Promise.all([
    scope.findHours(location.id, start.date, start.weekday),
    scope.findHours(location.id, yesterday, (start.weekday + 6) % 7),
  ]);
  const open = windows.some(
    (window, index) =>
      window !== null &&
      !window.closed &&
      fitsOpenWindow(period.startsAt, period.endsAt, location.timezone, index === 0 ? start.date : yesterday, window),
  );
  if (!open) {
    throw new ReservationFailure('RESERVATION_OUTSIDE_WORKING_HOURS');
  }
}

async function requireContact(scope: TenantReservations, contactId: string | undefined): Promise<void> {
  if (contactId === undefined) {
    return;
  }
  if ((await scope.findActiveContact(contactId)) === null) {
    throw new ReservationFailure('RESERVATION_CONTACT_NOT_FOUND');
  }
}

async function requireTable(scope: TenantReservations, command: CreateReservationCommand): Promise<void> {
  const table = await scope.findTable(command.requestedTableId);
  const bookable =
    table !== null &&
    table.locationId === command.locationId &&
    table.status === 'ACTIVE' &&
    table.archivedAt === null;
  if (!bookable || table === null) {
    throw new ReservationFailure('RESERVATION_TABLE_NOT_FOUND');
  }
  if (command.guestCount < table.minCapacity || command.guestCount > table.capacity) {
    throw new ReservationFailure('RESERVATION_TABLE_CAPACITY_EXCEEDED');
  }
}

async function requireAssignee(scope: TenantReservations, userId: string | undefined): Promise<void> {
  if (userId === undefined) {
    return;
  }
  if ((await scope.findActiveUser(userId)) === null) {
    throw new ReservationFailure('RESERVATION_ASSIGNEE_NOT_FOUND');
  }
}
