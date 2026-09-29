import { describe, expect, it } from 'vitest';

import { defineExternalHandler, type SideEffectFreeHandler } from './event-registry.js';
import { MemoryProcessedEventStore } from './processed-event-store.js';
import { ClassifiedHandlerError, outboxFailureAction } from './retry-classification.js';
import { runRegisteredHandlers } from './run-handlers.js';

const event = {
  eventId: '11111111-1111-4111-8111-111111111111',
  eventType: 'contact.created',
  eventVersion: 1,
  payload: { name: 'Ada' },
};

describe('handler idempotency', () => {
  it('runs an external handler through the durable reservation', async () => {
    const store = new MemoryProcessedEventStore();
    let sends = 0;
    const mailer = defineExternalHandler({
      handler: {
        name: 'Mailer',
        async handle(): Promise<void> {
          sends += 1;
        },
      },
      store,
      eventType: event.eventType,
      eventVersion: event.eventVersion,
    });

    await runRegisteredHandlers([mailer], event);
    await runRegisteredHandlers([mailer], event);

    expect(sends).toBe(1);
  });

  it('does not attach an idempotency key to a handler without an external side effect', async () => {
    let runs = 0;
    const projector: SideEffectFreeHandler = {
      handler: {
        name: 'Projector',
        async handle(): Promise<void> {
          runs += 1;
        },
      },
      retryClassification: 'transient',
      hasExternalSideEffect: false,
    };

    await runRegisteredHandlers([projector], event);
    await runRegisteredHandlers([projector], event);

    expect(runs).toBe(2);
  });

  it('fails the outbox row when a permanent handler throws beside a transient one', async () => {
    const calls: string[] = [];

    const error = await rejectHandlers([
      recordingHandler('Projector', 'transient', async () => {
        calls.push('projector');
      }),
      recordingHandler('Rules', 'permanent', async () => {
        throw new Error('business rule');
      }),
    ]);

    expect(error).toBeInstanceOf(ClassifiedHandlerError);
    expect(error.classification).toBe('permanent');
    expect(outboxFailureAction(error)).toBe('fail');
    expect(calls).toEqual(['projector']);
  });

  it('retries when a transient handler throws before a later permanent handler', async () => {
    let laterRuns = 0;

    const error = await rejectHandlers([
      recordingHandler('Projector', 'transient', async () => {
        throw new Error('timeout');
      }),
      recordingHandler('Rules', 'permanent', async () => {
        laterRuns += 1;
      }),
    ]);

    expect(error.classification).toBe('transient');
    expect(outboxFailureAction(error)).toBe('retry');
    expect(laterRuns).toBe(0);
  });
});

function recordingHandler(
  name: string,
  retryClassification: 'transient' | 'permanent',
  handle: () => Promise<void>,
): SideEffectFreeHandler {
  return {
    handler: { name, handle },
    retryClassification,
    hasExternalSideEffect: false,
  };
}

async function rejectHandlers(handlers: readonly SideEffectFreeHandler[]): Promise<ClassifiedHandlerError> {
  try {
    await runRegisteredHandlers(handlers, event);
  } catch (error) {
    if (error instanceof ClassifiedHandlerError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected a handler failure');
}
