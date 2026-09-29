import {
  contactCreatedEventSchema,
  tenantCreatedEventSchema,
  tenantCreatedEventV1Schema,
} from '@lobby/contracts';

import type { ContactCreatedHandler } from '../handlers/contact-created.handler.js';
import type { TenantCreatedHandler } from '../handlers/tenant-created.handler.js';
import { PermanentDispatchError } from './retry-classification.js';
import type { RetryClassification } from './retry-classification.js';

type EventSchema<T = unknown> = {
  parse(data: unknown): T;
};

/** Handler with no external effect. Dispatch does not require an idempotency key. */
export type SideEffectFreeHandler = {
  readonly name: string;
  readonly hasExternalSideEffect: false;
  handle(event: unknown): Promise<void>;
};

/**
 * Email, SMS, webhook, push, or another third-party call.
 * `wasAlreadyApplied` runs before `handle` and is required at registration.
 */
export type ExternalSideEffectHandler = {
  readonly name: string;
  readonly hasExternalSideEffect: true;
  wasAlreadyApplied(eventId: string): Promise<boolean>;
  handle(event: unknown): Promise<void>;
};

export type RegisteredHandler = SideEffectFreeHandler | ExternalSideEffectHandler;

export type EventRegistryEntry<TVersion extends number = number> = {
  readonly eventType: string;
  readonly eventVersion: TVersion;
  readonly schema: EventSchema;
  readonly handlers: readonly RegisteredHandler[];
  readonly retry: RetryClassification;
};

export type EventRegistry<TEntries extends readonly EventRegistryEntry[] = readonly EventRegistryEntry[]> = {
  get(eventType: string, eventVersion: number): TEntries[number] | undefined;
  list(): TEntries;
};

export type HandlerIdempotencyShape = {
  readonly name: string;
  readonly hasExternalSideEffect: boolean;
  readonly wasAlreadyApplied?: unknown;
};

type WorkerHandlers = {
  contactCreated: ContactCreatedHandler;
  tenantCreated: TenantCreatedHandler;
};

/** Composite registry key. Versions of one event type do not share an entry. */
export function eventRegistryKey(eventType: string, eventVersion: number): string {
  return `${eventType}@${eventVersion}`;
}

/** Preserves a literal `eventVersion` instead of widening it to `number`. */
export function defineEventRegistryEntry<const TVersion extends number>(
  entry: EventRegistryEntry<TVersion>,
): EventRegistryEntry<TVersion> {
  return entry;
}

/**
 * Fails when two entries use the same `eventType@eventVersion`,
 * or a side-effect handler has no idempotency check.
 */
export function buildEventRegistry<const TEntries extends readonly EventRegistryEntry[]>(
  entries: TEntries,
): EventRegistry<TEntries> {
  const byKey = new Map<string, TEntries[number]>();
  for (const entry of entries) {
    for (const handler of entry.handlers) {
      assertHandlerIdempotency(handler);
    }
    const key = eventRegistryKey(entry.eventType, entry.eventVersion);
    if (byKey.has(key)) {
      throw new Error(`Duplicate event registry entry: ${key}`);
    }
    byKey.set(key, entry);
  }
  return {
    get(eventType: string, eventVersion: number): TEntries[number] | undefined {
      return byKey.get(eventRegistryKey(eventType, eventVersion));
    },
    list(): TEntries {
      return entries;
    },
  };
}

/** Startup registration for events the API already writes to the outbox. */
export function createWorkerEventRegistry(handlers: WorkerHandlers) {
  return buildEventRegistry(workerRegistryEntries(handlers));
}

export type WorkerEventRegistry = ReturnType<typeof createWorkerEventRegistry>;

function workerRegistryEntries(handlers: WorkerHandlers): readonly [
  EventRegistryEntry<1>,
  EventRegistryEntry<1>,
  EventRegistryEntry<2>,
] {
  const contactSchema = asEventSchema(contactCreatedEventSchema);
  const tenantV1Schema = asEventSchema(tenantCreatedEventV1Schema);
  const tenantSchema = asEventSchema(tenantCreatedEventSchema);
  return [
    defineEventRegistryEntry({
      eventType: 'contact.created',
      eventVersion: 1,
      schema: contactSchema,
      retry: 'transient',
      handlers: [
        bindSideEffectFree('ContactCreatedHandler', contactSchema, (event) =>
          handlers.contactCreated.handle(event),
        ),
      ],
    }),
    defineEventRegistryEntry({
      eventType: 'tenant.created',
      eventVersion: 1,
      schema: tenantV1Schema,
      retry: 'transient',
      handlers: [
        bindSideEffectFree('TenantCreatedHandler', tenantV1Schema, (event) =>
          handlers.tenantCreated.handle(event),
        ),
      ],
    }),
    defineEventRegistryEntry({
      eventType: 'tenant.created',
      eventVersion: 2,
      schema: tenantSchema,
      retry: 'transient',
      handlers: [
        bindSideEffectFree('TenantCreatedHandler', tenantSchema, (event) =>
          handlers.tenantCreated.handle(event),
        ),
      ],
    }),
  ];
}

/** Rejects an external side effect that can run twice without a dedupe check. */
export function assertHandlerIdempotency(handler: HandlerIdempotencyShape): void {
  if (handler.hasExternalSideEffect && typeof handler.wasAlreadyApplied !== 'function') {
    throw new Error(`Handler ${handler.name} has an external side effect without idempotency`);
  }
}

function bindSideEffectFree<T>(
  name: string,
  schema: EventSchema<T>,
  handle: (event: T) => Promise<void>,
): SideEffectFreeHandler {
  return {
    name,
    hasExternalSideEffect: false,
    async handle(event: unknown): Promise<void> {
      await handle(parseRegisteredEvent(schema, event, name));
    },
  };
}

function parseRegisteredEvent<T>(schema: EventSchema<T>, event: unknown, name: string): T {
  try {
    return schema.parse(event);
  } catch (error) {
    if (error instanceof PermanentDispatchError) {
      throw error;
    }
    throw new PermanentDispatchError(`Invalid event payload for ${name}`);
  }
}

function asEventSchema<T>(schema: { parse(data: unknown): T }): EventSchema<T> {
  return {
    parse(data: unknown): T {
      return schema.parse(data);
    },
  };
}
