import { z } from 'zod';

import {
  RESERVATION_MAX_DURATION_MINUTES,
  RESERVATION_MAX_GUESTS,
  RESERVATION_MIN_DURATION_MINUTES,
  RESERVATION_MIN_GUESTS,
  RESERVATION_NOTE_MAX_LENGTH,
} from './create-reservation.js';

const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable();

/** Staff update. Source identity and tenant ownership are immutable. */
export const updateReservationSchema = z
  .strictObject({
    locationId: z.uuid().optional(),
    startsAt: z.iso.datetime().optional(),
    durationMinutes: z.number().int().min(RESERVATION_MIN_DURATION_MINUTES).max(RESERVATION_MAX_DURATION_MINUTES).optional(),
    guestCount: z.number().int().min(RESERVATION_MIN_GUESTS).max(RESERVATION_MAX_GUESTS).optional(),
    requestedTableId: z.uuid().optional(),
    assignedUserId: z.uuid().nullable().optional(),
    contactId: z.uuid().nullable().optional(),
    customerName: z.string().trim().min(1).max(200).optional(),
    customerPhone: nullableText(32).optional(),
    customerEmail: z.email().nullable().optional(),
    customerNote: nullableText(RESERVATION_NOTE_MAX_LENGTH).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

export const cancelReservationSchema = z.strictObject({
  reason: z.string().trim().min(1).max(500).optional(),
});

/** Optional note stored on the status-history and audit rows. An empty body is accepted. */
export const transitionReservationSchema = z
  .strictObject({
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .default({});

export type UpdateReservationInput = z.input<typeof updateReservationSchema>;
export type UpdateReservationCommand = z.output<typeof updateReservationSchema>;
export type CancelReservationInput = z.input<typeof cancelReservationSchema>;
export type TransitionReservationInput = z.input<typeof transitionReservationSchema>;
