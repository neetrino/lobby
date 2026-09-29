import { z } from 'zod';

/** Name only. A client tenant id is not part of the command. */
export const renameContactSchema = z.object({
  name: z.string().trim().min(1),
});

export type RenameContactInput = z.infer<typeof renameContactSchema>;
