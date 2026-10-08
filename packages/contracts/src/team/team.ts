import { z } from 'zod';

export const teamRoles = ['OWNER', 'ADMIN', 'MEMBER'] as const;

export const teamRoleSchema = z.enum(teamRoles);

export const teamMemberSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1).max(500),
  email: z.email(),
  role: teamRoleSchema,
  jobTitle: z.string().min(1).max(80).nullable(),
});

export const teamDirectorySchema = z.strictObject({
  organization: z.strictObject({
    name: z.string().min(1).max(500),
  }),
  members: z.array(teamMemberSchema),
});

export const teamDirectoryResponseSchema = z.strictObject({
  data: teamDirectorySchema,
});

export const teamMemberResponseSchema = z.strictObject({
  data: teamMemberSchema,
});

export const directMessageSchema = z.strictObject({
  id: z.uuid(),
  authorUserId: z.uuid(),
  authorName: z.string().min(1).max(500),
  body: z.string().min(1).max(2000),
  createdAt: z.iso.datetime(),
});

export const directMessageResponseSchema = z.strictObject({
  data: directMessageSchema,
});

export const directMessagePageSchema = z.strictObject({
  data: z.array(directMessageSchema),
  page: z.strictObject({
    nextCursor: z.string().nullable(),
    syncCursor: z.string().nullable(),
  }),
});

export type TeamRole = z.infer<typeof teamRoleSchema>;
export type TeamMember = z.infer<typeof teamMemberSchema>;
export type TeamDirectory = z.infer<typeof teamDirectorySchema>;
export type DirectMessage = z.infer<typeof directMessageSchema>;
export type DirectMessagePage = z.infer<typeof directMessagePageSchema>;
