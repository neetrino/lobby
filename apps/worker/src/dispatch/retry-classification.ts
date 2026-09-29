export const retryClassifications = ['transient', 'permanent', 'idempotent-side-effect'] as const;

export type RetryClassification = (typeof retryClassifications)[number];

/** Handler failure that must not be retried, whatever the registry entry default is. */
export class PermanentDispatchError extends Error {
  readonly classification = 'permanent' as const;

  constructor(message: string) {
    super(message);
    this.name = 'PermanentDispatchError';
  }
}

/**
 * Schema and explicit permanent errors override a retryable registry default.
 * `idempotent-side-effect` stays retryable; that handler must dedupe before the effect.
 */
export function handlerFailureIsPermanent(retry: RetryClassification, error: unknown): boolean {
  if (error instanceof PermanentDispatchError) {
    return true;
  }
  return retry === 'permanent';
}
