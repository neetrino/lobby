import {
  contactCreatedEventSchema,
  tenantCreatedEventSchema,
  tenantCreatedEventV1Schema,
} from '@lobby/contracts';
import { describe, expect, it } from 'vitest';

import { ContactCreatedHandler } from '../handlers/contact-created.handler.js';
import { TenantCreatedHandler } from '../handlers/tenant-created.handler.js';
import {
  assertHandlerIdempotency,
  buildEventRegistry,
  createWorkerEventRegistry,
  defineEventRegistryEntry,
  defineExternalHandler,
  eventRegistryKey,
} from './event-registry.js';
import { MemoryProcessedEventStore } from './processed-event-store.js';
import {
  handlerFailureIsPermanent,
  outboxFailureAction,
  PermanentDispatchError,
} from './retry-classification.js';

type AssertTrue<T extends true> = T;
type ListedVersion = ReturnType<
  ReturnType<typeof createWorkerEventRegistry>['list']
>[number]['eventVersion'];
type _versionIsLiteral = AssertTrue<number extends ListedVersion ? false : true>;

describe('event registry', () => {
  it('registers one entry per current eventType@eventVersion', () => {
    const registry = createRegistry();

    expect(
      registry.list().map((entry) => eventRegistryKey(entry.eventType, entry.eventVersion)),
    ).toEqual(['contact.created@1', 'tenant.created@1', 'tenant.created@2']);
    expect(
      registry.list().map((entry) => entry.handlers.map((handler) => handler.retryClassification)),
    ).toEqual([['transient'], ['transient'], ['transient']]);
    expect(
      registry.list().map((entry) => entry.handlers.map((handler) => handler.handler.name)),
    ).toEqual([['ContactCreatedHandler'], ['TenantCreatedHandler'], ['TenantCreatedHandler']]);
    for (const entry of registry.list()) {
      for (const handler of entry.handlers) {
        expect(handler.hasExternalSideEffect).toBe(false);
        expect('delivery' in handler).toBe(false);
        expect('retry' in entry).toBe(false);
      }
    }
  });

  it('fails startup when the same eventType@eventVersion is registered twice', () => {
    const entry = defineEventRegistryEntry({
      eventType: 'contact.created',
      eventVersion: 1,
      schema: contactCreatedEventSchema,
      handlers: [],
    });

    expect(() => buildEventRegistry([entry, entry])).toThrow(
      'Duplicate event registry entry: contact.created@1',
    );
  });

  it('keeps tenant.created versions as separate entries', () => {
    const registry = buildEventRegistry([
      defineEventRegistryEntry({
        eventType: 'tenant.created',
        eventVersion: 1,
        schema: tenantCreatedEventV1Schema,
        handlers: [sideEffectFree('V1', 'permanent')],
      }),
      defineEventRegistryEntry({
        eventType: 'tenant.created',
        eventVersion: 2,
        schema: tenantCreatedEventSchema,
        handlers: [sideEffectFree('V2', 'transient')],
      }),
    ]);

    expect(registry.get('tenant.created', 1)?.handlers[0]?.retryClassification).toBe('permanent');
    expect(registry.get('tenant.created', 2)?.handlers[0]?.retryClassification).toBe('transient');
    expect(registry.get('tenant.created', 3)).toBeUndefined();
  });

  it('requires durable idempotency only for an external side effect', () => {
    expect(() =>
      assertHandlerIdempotency({
        name: 'Mailer',
        hasExternalSideEffect: true,
      }),
    ).toThrow('Handler Mailer has an external side effect without durable idempotency');

    expect(() =>
      assertHandlerIdempotency({
        name: 'Projector',
        hasExternalSideEffect: false,
      }),
    ).not.toThrow();

    const registered = defineExternalHandler({
      handler: { name: 'Mailer', handle: () => Promise.resolve() },
      store: new MemoryProcessedEventStore(),
      eventType: 'contact.created',
      eventVersion: 1,
    });
    expect(() => assertHandlerIdempotency(registered)).not.toThrow();
    expect(registered.retryClassification).toBe('idempotent-side-effect');
  });

  it('treats validation as permanent and leaves side-effect retries retryable', () => {
    const transient = new Error('timeout');
    expect(handlerFailureIsPermanent('transient', transient)).toBe(false);
    expect(handlerFailureIsPermanent('idempotent-side-effect', transient)).toBe(false);
    expect(handlerFailureIsPermanent('permanent', transient)).toBe(true);
    expect(handlerFailureIsPermanent('transient', new PermanentDispatchError('invalid'))).toBe(
      true,
    );
    expect(outboxFailureAction(new PermanentDispatchError('invalid'))).toBe('fail');
  });
});

function sideEffectFree(
  name: string,
  retryClassification: 'transient' | 'permanent',
): {
  handler: { name: string; handle: () => Promise<void> };
  retryClassification: 'transient' | 'permanent';
  hasExternalSideEffect: false;
} {
  return {
    handler: {
      name,
      handle: () => Promise.resolve(),
    },
    retryClassification,
    hasExternalSideEffect: false,
  };
}

function createRegistry() {
  return createWorkerEventRegistry({
    contactCreated: new ContactCreatedHandler(),
    tenantCreated: new TenantCreatedHandler(),
  });
}
