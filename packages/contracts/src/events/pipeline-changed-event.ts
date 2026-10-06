import { z } from 'zod';

import { versionedEventSchema } from './versioned-event.js';

export const PIPELINE_CHANGED_EVENT_VERSION = 1;

/** Board change for later projections. The payload has no card title, company, or amount. */
export const pipelineChangedEventSchema = versionedEventSchema.extend({
  eventType: z.literal('pipeline.changed'),
  eventVersion: z.literal(PIPELINE_CHANGED_EVENT_VERSION),
  aggregateType: z.literal('pipeline'),
  payload: z.strictObject({
    kind: z.enum(['lead', 'deal']),
    change: z.enum(['configured', 'deleted', 'moved', 'converted']),
  }),
});

export type PipelineChangedEvent = z.infer<typeof pipelineChangedEventSchema>;
