import { z } from 'zod';

export const reservationStatuses = [
  'HOLD',
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
