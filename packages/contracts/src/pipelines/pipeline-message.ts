import { z } from 'zod';

export const pipelineMessageSchema = z.strictObject({
  id: z.uuid(),
  cardId: z.uuid(),
  authorUserId: z.uuid(),
  authorName: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  createdAt: z.iso.datetime(),
});

export const pipelineMessagesResponseSchema = z.strictObject({
  data: z.array(pipelineMessageSchema),
});

export const pipelineMessageResponseSchema = z.strictObject({
  data: pipelineMessageSchema,
});

export type PipelineMessage = z.infer<typeof pipelineMessageSchema>;
