import { describe, expect, it } from 'vitest';

import type { ExternalSideEffectHandler, SideEffectFreeHandler } from './event-registry.js';
import { runRegisteredHandlers } from './run-handlers.js';

const event = {
  eventId: '11111111-1111-4111-8111-111111111111',
  eventType: 'contact.created',
  eventVersion: 1,
  payload: { name: 'Ada' },
};

describe('handler idempotency', () => {
  it('sends an external side effect once when the same event is dispatched twice', async () => {
    const applied = new Set<string>();
    const calls: string[] = [];
    const mailer: ExternalSideEffectHandler = {
      name: 'Mailer',
      hasExternalSideEffect: true,
      async wasAlreadyApplied(eventId: string): Promise<boolean> {
        calls.push(`check:${eventId}`);
        return applied.has(eventId);
      },
      async handle(value: unknown): Promise<void> {
        const eventId = readEventId(value);
        calls.push(`send:${eventId}`);
        applied.add(eventId);
      },
    };

    await runRegisteredHandlers([mailer], event);
    await runRegisteredHandlers([mailer], event);

    expect(calls).toEqual([
      `check:${event.eventId}`,
      `send:${event.eventId}`,
      `check:${event.eventId}`,
    ]);
  });

  it('does not attach an idempotency key to a handler without an external side effect', async () => {
    let runs = 0;
    const projector: SideEffectFreeHandler = {
      name: 'Projector',
      hasExternalSideEffect: false,
      async handle(): Promise<void> {
        runs += 1;
      },
    };

    await runRegisteredHandlers([projector], event);
    await runRegisteredHandlers([projector], event);

    expect(runs).toBe(2);
  });
});

function readEventId(value: unknown): string {
  if (typeof value !== 'object' || value === null || !('eventId' in value) || typeof value.eventId !== 'string') {
    throw new Error('expected eventId');
  }
  return value.eventId;
}
