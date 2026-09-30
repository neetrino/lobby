import { z } from 'zod';

/** Contact name. Unknown fields, including a client tenant id, are rejected. */
export const createContactSchema = z.strictObject({
  name: z.string().trim().min(1),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
