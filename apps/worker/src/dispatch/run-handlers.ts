import type { RegisteredHandler } from './event-registry.js';
import { classifyHandlerFailure } from './retry-classification.js';

/**
 * Runs every handler for one registry entry.
 * Stops at the first throw. That handler's classification decides the outbox row.
 */
export async function runRegisteredHandlers(
  handlers: readonly RegisteredHandler[],
  event: unknown,
): Promise<void> {
  for (const registration of handlers) {
    await runOneHandler(registration, event);
  }
}

async function runOneHandler(registration: RegisteredHandler, event: unknown): Promise<void> {
  try {
    await invokeHandler(registration, event);
  } catch (error) {
    throw classifyHandlerFailure(registration.retryClassification, error);
  }
}

async function invokeHandler(registration: RegisteredHandler, event: unknown): Promise<void> {
  if (registration.hasExternalSideEffect) {
    await registration.delivery.run(event);
    return;
  }
  await registration.handler.handle(event);
}
