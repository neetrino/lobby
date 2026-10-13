import { z } from 'zod';

export const teamMemberIdSchema = z.uuid();

export const jobTitlePatchSchema = z.strictObject({
  jobTitle: z.string().trim().min(1).max(80).nullable(),
});

export const directMessageBodySchema = z.strictObject({
  body: z.string().trim().min(1).max(2000),
});

export type JobTitlePatch = z.infer<typeof jobTitlePatchSchema>;
export type DirectMessageBody = z.infer<typeof directMessageBodySchema>;
