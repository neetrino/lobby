/** Two board writes asked for the same column or card position. */
export class PipelineConflictError extends Error {
  readonly code = 'PIPELINE_CONFLICT' as const;
  readonly statusCode = 409;

  constructor(message = 'The board changed. Retry the action.') {
    super(message);
    this.name = 'PipelineConflictError';
  }
}
