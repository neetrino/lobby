const MAX_OUTBOX_ERROR_LENGTH = 500;

export function sanitizeOutboxError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Outbox delivery failed';
  const withoutSecrets = message.replace(/(postgres(?:ql)?:\/\/)\S+/gi, '$1[redacted]');
  return withoutSecrets.slice(0, MAX_OUTBOX_ERROR_LENGTH);
}
