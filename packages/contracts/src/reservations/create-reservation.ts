import { z } from 'zod';

/** One minute through one local day. Working hours still bound the actual visit. */
export const RESERVATION_MIN_DURATION_MINUTES = 1;
export const RESERVATION_MAX_DURATION_MINUTES = 24 * 60;
export const RESERVATION_MIN_GUESTS = 1;
export const RESERVATION_MAX_GUESTS = 100;
export const RESERVATION_NOTE_MAX_LENGTH = 500;

export const reservationSources = [
  'STAFF',
  'WEBSITE',
  'INSTAGRAM',
  'WHATSAPP',
  'TELEGRAM',
  'PHONE',
  'WALK_IN',
] as const;

export type ReservationSource = (typeof reservationSources)[number];

const optionalText = (max: number) => z.string().trim().min(1).max(max).optional();

const sourceSchema = z.strictObject({
  type: z.enum(reservationSources),
  accountId: optionalText(200),
  externalRequestId: optionalText(200),
  conversationId: optionalText(200),
  messageId: optionalText(200),
});

/**
 * Staff or channel booking command.
 * The tenant comes from the actor, never from this body.
 * `requestedTableId` is required until automatic table selection exists.
 * Duration is 1–1440 minutes.
 */
export const createReservationSchema = z
  .strictObject({
    locationId: z.uuid(),
    startsAt: z.iso.datetime(),
    durationMinutes: z
      .number()
      .int()
      .min(RESERVATION_MIN_DURATION_MINUTES)
      .max(RESERVATION_MAX_DURATION_MINUTES),
    guestCount: z.number().int().min(RESERVATION_MIN_GUESTS).max(RESERVATION_MAX_GUESTS),
    customer: z.strictObject({
      name: z.string().trim().min(1).max(200),
      phone: optionalText(32),
      email: z.email().optional(),
      contactId: z.uuid().optional(),
    }),
    requestedTableId: z.uuid(),
    assignedUserId: z.uuid().optional(),
    customerNote: optionalText(RESERVATION_NOTE_MAX_LENGTH),
    source: sourceSchema,
  })
  .superRefine((value, context) => {
    const hasPhone = value.customer.phone !== undefined;
    const hasEmail = value.customer.email !== undefined;
    if (value.source.type !== 'WALK_IN' && !hasPhone && !hasEmail) {
      context.addIssue({
        code: 'custom',
        path: ['customer'],
        message: 'Phone or email is required',
      });
    }
    const hasAccount = value.source.accountId !== undefined;
    const hasRequest = value.source.externalRequestId !== undefined;
    if (hasAccount !== hasRequest) {
      context.addIssue({
        code: 'custom',
        path: ['source'],
        message: 'Idempotency account and request id are paired',
      });
    }
  });

export type CreateReservationInput = z.input<typeof createReservationSchema>;
export type CreateReservationCommand = z.output<typeof createReservationSchema>;
