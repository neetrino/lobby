import { z } from 'zod';

export const pipelineNoteSchema = z.strictObject({
  id: z.uuid(),
  cardId: z.uuid(),
  authorUserId: z.uuid(),
  authorName: z.string().min(1).max(120),
  body: z.string().min(1).max(4000),
  createdAt: z.iso.datetime(),
});

export const pipelineNotesResponseSchema = z.strictObject({ data: z.array(pipelineNoteSchema) });
export const pipelineNoteResponseSchema = z.strictObject({ data: pipelineNoteSchema });

export type PipelineNote = z.infer<typeof pipelineNoteSchema>;
