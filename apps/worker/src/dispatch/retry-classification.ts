export const retryClassifications = ['transient', 'permanent', 'idempotent-side-effect'] as const;

export type RetryClassification = (typeof retryClassifications)[number];

/** Handler failure that must not be retried, whatever that handler's classification is. */
export class PermanentDispatchError extends Error {
  readonly classification = 'permanent' as const;

  constructor(message: string) {
    super(message);
    this.name = 'PermanentDispatchError';
  }
}

/**
 * Failure of one handler, carrying that handler's classification.
 * The outbox row has a single status, so dispatch stops at this error.
 */
export class ClassifiedHandlerError extends Error {
  readonly classification: RetryClassification;

  constructor(classification: RetryClassification, cause: unknown) {
    super(readErrorMessage(cause), { cause });
    this.name = 'ClassifiedHandlerError';
    this.classification = classification;
  }
}

/**
 * Schema and explicit permanent errors override a retryable handler classification.
 * `idempotent-side-effect` stays retryable at the outbox row. The effect itself is reserved first and is at-most-once.
 */
export function handlerFailureIsPermanent(retry: RetryClassification, error: unknown): boolean {
  if (error instanceof PermanentDispatchError) {
    return true;
  }
  return retry === 'permanent';
}

/**
 * The failing handler owns the outbox outcome for this attempt.
 * A later handler does not run, so its classification is not consulted.
 * `PermanentDispatchError` is always permanent.
 */
export function resolveFailureClassification(error: unknown): RetryClassification {
  if (error instanceof ClassifiedHandlerError) {
    return error.classification;
  }
  return 'permanent';
}

/** Maps one handler failure onto the single outbox row: retry, or fail immediately. */
export function outboxFailureAction(error: unknown): 'retry' | 'fail' {
  const classification = resolveFailureClassification(error);
  return handlerFailureIsPermanent(classification, error) ? 'fail' : 'retry';
}

export function classifyHandlerFailure(classification: RetryClassification, error: unknown): Error {
  if (error instanceof PermanentDispatchError || error instanceof ClassifiedHandlerError) {
    return error;
  }
  return new ClassifiedHandlerError(classification, error);
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return 'Handler failed';
}
