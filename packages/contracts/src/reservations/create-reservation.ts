import { z } from 'zod';

const optionalTrimmedString = z.string().trim().min(1).optional();

export const createReservationSchema = z
  .object({
    venueId: z.uuid(),
    contactId: z.uuid().optional(),
    tableIds: z.array(z.uuid()).min(1),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    partySize: z.number().int().positive(),
    customerName: z.string().trim().min(1),
    customerPhone: optionalTrimmedString,
    customerEmail: z.email().optional(),
    specialRequests: optionalTrimmedString,
    internalNotes: optionalTrimmedString,
  })
  .superRefine((value, context) => {
    if (new Set(value.tableIds).size !== value.tableIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['tableIds'],
        message: 'Table identifiers must be unique',
      });
    }

    if (Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
      context.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'Reservation end must be after its start',
      });
    }
  });

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
