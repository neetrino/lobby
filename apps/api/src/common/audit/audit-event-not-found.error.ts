/** Missing audit row, including a row that belongs to another tenant. */
export class AuditEventNotFoundError extends Error {
  readonly code = 'AUDIT_EVENT_NOT_FOUND';
  readonly statusCode = 404;

  constructor() {
    super('The audit event was not found.');
    this.name = 'AuditEventNotFoundError';
  }
}
