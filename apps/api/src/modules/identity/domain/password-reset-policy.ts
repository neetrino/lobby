/** A reset link stays valid for 30 minutes. */
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export function passwordResetExpiresAt(now: Date): Date {
  return new Date(now.getTime() + PASSWORD_RESET_TTL_MS);
}
