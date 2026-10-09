import { localeSchema } from '@lobby/contracts';
import { z } from 'zod';

import { passwordPolicySchema } from '../../../identity';

const normalizedEmail = z.string().trim().toLowerCase().pipe(z.email());
const invitationToken = z.string().trim().min(43).max(128);

export const inviteMemberSchema = z.strictObject({
  email: normalizedEmail,
  role: z.literal('MEMBER'),
  locale: localeSchema.optional(),
});

export const resendInvitationSchema = z.strictObject({
  locale: localeSchema.optional(),
});

export const invitationIdSchema = z.uuid();

export const exchangeInvitationSchema = z.strictObject({
  invitationId: invitationIdSchema,
  token: invitationToken,
});

export const previewInvitationSchema = z.strictObject({
  invitationId: invitationIdSchema,
});

export const acceptInvitationSchema = previewInvitationSchema.extend({
  name: z.string().trim().min(1).max(200),
  password: passwordPolicySchema,
});

export type InviteMemberBody = z.infer<typeof inviteMemberSchema>;
export type ResendInvitationBody = z.infer<typeof resendInvitationSchema>;
export type ExchangeInvitationBody = z.infer<typeof exchangeInvitationSchema>;
export type PreviewInvitationBody = z.infer<typeof previewInvitationSchema>;
export type AcceptInvitationBody = z.infer<typeof acceptInvitationSchema>;
