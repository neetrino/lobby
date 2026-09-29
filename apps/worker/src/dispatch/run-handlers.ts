import type { RegisteredHandler } from './event-registry.js';
import { PermanentDispatchError } from './retry-classification.js';

/** Runs every handler for one registry entry. Side effects are deduped before `handle`. */
export async function runRegisteredHandlers(
  handlers: readonly RegisteredHandler[],
  event: unknown,
): Promise<void> {
  for (const handler of handlers) {
    if (await skipCompletedSideEffect(handler, event)) {
      continue;
    }
    await handler.handle(event);
  }
}

async function skipCompletedSideEffect(handler: RegisteredHandler, event: unknown): Promise<boolean> {
  if (!handler.hasExternalSideEffect) {
    return false;
  }
  return handler.wasAlreadyApplied(readEventId(event));
}

function readEventId(event: unknown): string {
  if (!isRecord(event) || typeof event.eventId !== 'string' || event.eventId.length === 0) {
    throw new PermanentDispatchError('Dispatched event is missing eventId');
  }
  return event.eventId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
