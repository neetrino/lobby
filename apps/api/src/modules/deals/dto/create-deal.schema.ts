import { z } from 'zod';

export const createDealSchema = z.object({
  contactId: z.string().trim().min(1),
  title: z.string().trim().min(1),
});

export type CreateDealInput = z.infer<typeof createDealSchema>;
