import { z } from 'zod';

export const sendMessageSchema = z.object({
  conversationId: z.string().trim().min(1),
  body: z.string().trim().min(1),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
