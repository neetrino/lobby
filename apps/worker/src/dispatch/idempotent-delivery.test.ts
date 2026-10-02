import { describe, expect, it } from 'vitest';

import { bindConfirmedDelivery, bindIdempotentDelivery } from './idempotent-delivery.js';
import { MemoryProcessedEventStore, type ProcessedEventStore } from './processed-event-store.js';

const identity = { eventType: 'contact.created', eventVersion: 1 };
const event = { eventId: '11111111-1111-4111-8111-111111111111' };

describe('idempotent delivery', () => {
  it('does not send again after the process dies once the reservation is committed', async () => {
    const store = new MemoryProcessedEventStore();
    let sends = 0;
    const handler = {
      name: 'Mailer',
      async handle(): Promise<void> {
        sends += 1;
      },
    };

    await bindIdempotentDelivery(handler, store, identity).run(event);
    await bindIdempotentDelivery(handler, store, identity).run(event);

    expect(sends).toBe(1);
  });

  it('does not send again when handle throws after the side effect', async () => {
    const store = new MemoryProcessedEventStore();
    let sends = 0;
    const handler = {
      name: 'Mailer',
      async handle(): Promise<void> {
        sends += 1;
        throw new Error('worker died after the provider accepted the call');
      },
    };

    await expect(bindIdempotentDelivery(handler, store, identity).run(event)).rejects.toThrow(
      'worker died after the provider accepted the call',
    );
    await bindIdempotentDelivery(handler, store, identity).run(event);

    expect(sends).toBe(1);
  });

  it('does not send when the reservation insert fails', async () => {
    let sends = 0;
    const store: ProcessedEventStore = {
      async tryReserve(): Promise<boolean> {
        throw new Error('processed_events insert failed');
      },
      async isProcessed(): Promise<boolean> {
        return false;
      },
    };
    const handler = {
      name: 'Mailer',
      async handle(): Promise<void> {
        sends += 1;
      },
    };

    await expect(bindIdempotentDelivery(handler, store, identity).run(event)).rejects.toThrow(
      'processed_events insert failed',
    );
    expect(sends).toBe(0);
  });

  it('retries a confirmed delivery when the provider rejects the first send', async () => {
    const store = new MemoryProcessedEventStore();
    let sends = 0;
    const handler = {
      name: 'MemberInvitationEmailHandler',
      async handle(): Promise<void> {
        sends += 1;
        if (sends === 1) {
          throw new Error('Email provider rejected the invitation.');
        }
      },
    };

    await expect(bindConfirmedDelivery(handler, store, identity).run(event)).rejects.toThrow(
      'Email provider rejected the invitation.',
    );
    await bindConfirmedDelivery(handler, store, identity).run(event);
    await bindConfirmedDelivery(handler, store, identity).run(event);

    expect(sends).toBe(2);
  });
});
