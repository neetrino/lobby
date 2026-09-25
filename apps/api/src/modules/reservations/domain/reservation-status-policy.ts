import type { ReservationStatus } from '@lobby/contracts';

export function canTransitionReservation(
  current: ReservationStatus,
  next: ReservationStatus,
): boolean {
  switch (current) {
    case 'HOLD':
      return next === 'PENDING' || next === 'CANCELLED';
    case 'PENDING':
      return next === 'CONFIRMED' || next === 'CANCELLED';
    case 'CONFIRMED':
      return next === 'ARRIVED' || next === 'CANCELLED' || next === 'NO_SHOW';
    case 'ARRIVED':
      return next === 'SEATED' || next === 'CANCELLED';
    case 'SEATED':
      return next === 'COMPLETED';
    case 'COMPLETED':
    case 'CANCELLED':
    case 'NO_SHOW':
      return false;
  }
}

export function assertReservationTransition(
  current: ReservationStatus,
  next: ReservationStatus,
): void {
  if (!canTransitionReservation(current, next)) {
    throw new Error(`Invalid reservation status transition: ${current} -> ${next}`);
  }
}
