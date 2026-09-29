import type { ApiErrorField } from './api-error-body';

/** Input failed a Zod schema. The client receives field paths, never the submitted value. */
export class ValidationError extends Error {
  readonly fields: readonly ApiErrorField[];

  constructor(fields: readonly ApiErrorField[]) {
    super('Validation failed.');
    this.name = 'ValidationError';
    this.fields = fields;
  }
}
