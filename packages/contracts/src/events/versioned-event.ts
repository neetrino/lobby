import { z } from 'zod';

/**
 * Shared domain-event envelope.
 * `occurredAt` must be an ISO-8601 UTC timestamp with a `Z` suffix.
 */
export const versionedEventSchema = z.object({
  eventId: z.uuid(),
  eventType: z.string().min(1),
  eventVersion: z.number().int().positive(),
  tenantId: z.uuid(),
  aggregateType: z.string().min(1),
  aggregateId: z.uuid(),
  occurredAt: z.iso.datetime(),
});

export type VersionedEvent = z.infer<typeof versionedEventSchema>;
