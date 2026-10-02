import { z } from 'zod';

import { tenantPlanSchema, tenantSubdomainSchema } from '../tenants/tenant-foundation.js';
import { versionedEventSchema } from './versioned-event.js';

/** Previous payload used `userId`. The worker still accepts this version. */
export const tenantCreatedEventV1Schema = versionedEventSchema.extend({
  eventType: z.literal('tenant.created'),
  eventVersion: z.literal(1),
  aggregateType: z.literal('tenant'),
  payload: z.object({
    name: z.string().trim().min(1),
    subdomain: z.string().trim().min(1),
    plan: z.string().trim().min(1),
    userId: z.uuid(),
  }),
});

export type TenantCreatedEventV1 = z.infer<typeof tenantCreatedEventV1Schema>;

export const TENANT_CREATED_EVENT_VERSION = 2;

export const tenantCreatedEventSchema = versionedEventSchema.extend({
  eventType: z.literal('tenant.created'),
  eventVersion: z.literal(TENANT_CREATED_EVENT_VERSION),
  aggregateType: z.literal('tenant'),
  payload: z.strictObject({
    name: z.string().trim().min(1),
    subdomain: tenantSubdomainSchema,
    plan: tenantPlanSchema,
    ownerUserId: z.uuid(),
  }),
});

export type TenantCreatedEvent = z.infer<typeof tenantCreatedEventSchema>;
