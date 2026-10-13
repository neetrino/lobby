import { pageLimitSchema } from '@lobby/contracts';
import { z } from 'zod';

import { decodeCursor } from '../../../common/pagination';

const MESSAGE_CURSOR_MAX_LENGTH = 1024;

const messageCursorSchema = z.strictObject({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
  memberId: z.uuid(),
});

export type MessageCursor = z.infer<typeof messageCursorSchema>;

const opaqueCursorSchema = z
  .string()
  .min(1)
  .max(MESSAGE_CURSOR_MAX_LENGTH)
  .transform((value, context) => {
    const parsed = messageCursorSchema.safeParse(decodeCursor(value));
    if (!parsed.success) {
      context.addIssue({ code: 'custom', message: 'Invalid cursor' });
      return z.NEVER;
    }
    return parsed.data;
  });

export const directMessageListQuerySchema = z
  .strictObject({
    limit: pageLimitSchema,
    cursor: opaqueCursorSchema.optional(),
    after: opaqueCursorSchema.optional(),
  })
  .refine((query) => query.cursor === undefined || query.after === undefined, {
    path: ['after'],
    message: 'cursor and after cannot both be set',
  });

export type DirectMessageListQuery = z.output<typeof directMessageListQuerySchema>;
