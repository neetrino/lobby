import { z } from 'zod';

export const createContactSchema = z.object({
  name: z.string().trim().min(1),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
