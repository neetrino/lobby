import { z } from 'zod';

export const availabilityQuerySchema = z.strictObject({
  locationId: z.uuid(),
  startsAt: z.iso.datetime(),
  durationMinutes: z.coerce.number().int().min(1).max(1440),
  guestCount: z.coerce.number().int().min(1).max(100),
  excludeReservationId: z.uuid().optional(),
});

export type AvailabilityQuery = z.output<typeof availabilityQuerySchema>;
