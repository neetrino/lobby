/** Two contacts in one tenant cannot share an email. The message does not include the address. */
export class ContactEmailConflictError extends Error {
  readonly code = 'CONTACT_EMAIL_TAKEN' as const;
  readonly statusCode = 409;

  constructor() {
    super('A contact with this email already exists.');
    this.name = 'ContactEmailConflictError';
  }
}

export function isContactEmailConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
