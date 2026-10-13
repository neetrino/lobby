/** A column that still holds cards cannot be removed. */
export class PipelineColumnNotEmptyError extends Error {
  readonly code = 'PIPELINE_COLUMN_NOT_EMPTY' as const;
  readonly statusCode = 409;

  constructor() {
    super('Move the cards out of this column before deleting it.');
    this.name = 'PipelineColumnNotEmptyError';
  }
}
