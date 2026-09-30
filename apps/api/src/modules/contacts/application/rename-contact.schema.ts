import { z } from 'zod';

/** New name only. Unknown fields, including a client tenant id, are rejected. */
export const renameContactSchema = z.strictObject({
  name: z.string().trim().min(1),
});

export type RenameContactInput = z.infer<typeof renameContactSchema>;
