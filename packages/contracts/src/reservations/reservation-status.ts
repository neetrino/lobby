import { z } from 'zod';

export const reservationStatuses = [
  'PENDING',
  'CONFIRMED',
  'ARRIVED',
  'SEATED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

export const reservationStatusSchema = z.enum(reservationStatuses);

export type ReservationStatus = z.infer<typeof reservationStatusSchema>;

/** Staff actions that move a booking along the service path. Cancellation stays a separate route. */
export const reservationTransitionActions = ['confirm', 'arrive', 'seat', 'complete', 'no-show'] as const;

export const reservationTransitionActionSchema = z.enum(reservationTransitionActions);

export type ReservationTransitionAction = z.infer<typeof reservationTransitionActionSchema>;

const reservationTransitionTargets = {
  confirm: 'CONFIRMED',
  arrive: 'ARRIVED',
  seat: 'SEATED',
  complete: 'COMPLETED',
  'no-show': 'NO_SHOW',
} as const satisfies Record<ReservationTransitionAction, ReservationStatus>;

/** Maps a public transition action to the stored reservation status. */
export function reservationTransitionTarget(action: ReservationTransitionAction): ReservationStatus {
  return reservationTransitionTargets[action];
}
