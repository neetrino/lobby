/** The account turned Leads off. Deal routes stay available. */
export class LeadsDisabledError extends Error {
  readonly code = 'LEADS_DISABLED' as const;
  readonly statusCode = 403;

  constructor() {
    super('Leads are turned off for this account.');
    this.name = 'LeadsDisabledError';
  }
}
