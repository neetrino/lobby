import { z } from 'zod';

import { versionedEventSchema } from './versioned-event.js';

export const tenantCreatedEventSchema = versionedEventSchema.extend({
  eventType: z.literal('tenant.created'),
  aggregateType: z.literal('tenant'),
  payload: z.object({
    name: z.string().trim().min(1),
    subdomain: z.string().trim().min(1),
    plan: z.string().trim().min(1),
    userId: z.uuid(),
  }),
});

export type TenantCreatedEvent = z.infer<typeof tenantCreatedEventSchema>;
