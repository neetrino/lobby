/** Invitation lifetime. The acceptance email states the same 72 hours. */
export const INVITATION_TTL_MS = 72 * 60 * 60 * 1000;

/** The only role an invitation may grant. OWNER and ADMIN stay out of this flow. */
export const INVITABLE_ROLE = 'MEMBER' as const;

export type InvitableRole = typeof INVITABLE_ROLE;

export function invitationExpiresAt(now: Date): Date {
  return new Date(now.getTime() + INVITATION_TTL_MS);
}

/** Open means unaccepted, unrevoked, and still before `expiresAt`. */
export function isInvitationOpen(
  invitation: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now: Date,
): boolean {
  return (
    invitation.acceptedAt === null &&
    invitation.revokedAt === null &&
    invitation.expiresAt.getTime() > now.getTime()
  );
}
