import {
  contactCreatedEventSchema,
  invitationCreatedEventSchema,
  tenantCreatedEventSchema,
  tenantCreatedEventV1Schema,
} from '@lobby/contracts';

import type { ContactCreatedHandler } from '../handlers/contact-created.handler.js';
import type { MemberInvitationEmailHandler } from '../handlers/member-invitation-email.handler.js';
import type { TenantCreatedHandler } from '../handlers/tenant-created.handler.js';
import {
  bindConfirmedDelivery,
  bindIdempotentDelivery,
  isDurableDelivery,
  type DurableDelivery,
} from './idempotent-delivery.js';
import type { ProcessedEventStore } from './processed-event-store.js';
import { PermanentDispatchError, type RetryClassification } from './retry-classification.js';

type EventSchema<T = unknown> = {
  parse(data: unknown): T;
};

/** Work performed for one registry entry. Retry policy lives on the registration, not here. */
export type EventHandler = {
  readonly name: string;
  handle(event: unknown): Promise<void>;
};

/** Handler with no external effect. Dispatch does not require an idempotency key. */
export type SideEffectFreeHandler = {
  readonly handler: EventHandler;
  readonly retryClassification: RetryClassification;
  readonly hasExternalSideEffect: false;
};

/**
 * Email, SMS, webhook, push, or another third-party call.
 * `delivery` is a durable reservation created by `defineExternalHandler`.
 */
export type ExternalSideEffectHandler = {
  readonly handler: EventHandler;
  readonly retryClassification: RetryClassification;
  readonly hasExternalSideEffect: true;
  readonly delivery: DurableDelivery;
};

export type RegisteredHandler = SideEffectFreeHandler | ExternalSideEffectHandler;

export type EventRegistryEntry<TVersion extends number = number> = {
  readonly eventType: string;
  readonly eventVersion: TVersion;
  readonly schema: EventSchema;
  readonly handlers: readonly RegisteredHandler[];
};

export type EventRegistry<
  TEntries extends readonly EventRegistryEntry[] = readonly EventRegistryEntry[],
> = {
  get(eventType: string, eventVersion: number): TEntries[number] | undefined;
  list(): TEntries;
};

export type HandlerIdempotencyShape = {
  readonly name?: string;
  readonly handler?: { readonly name: string };
  readonly hasExternalSideEffect: boolean;
  readonly delivery?: unknown;
};

export type ExternalHandlerInput = {
  readonly handler: EventHandler;
  readonly store: ProcessedEventStore;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly retryClassification?: RetryClassification;
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

/** External email delivery for `invitation.created@1`. The processed row is written after send. */
export function invitationEmailRegistryEntry(
  handler: MemberInvitationEmailHandler,
  store: ProcessedEventStore,
): EventRegistryEntry<1> {
  const schema = asEventSchema(invitationCreatedEventSchema);
  return defineEventRegistryEntry({
    eventType: 'invitation.created',
    eventVersion: 1,
    schema,
    handlers: [
      defineConfirmedExternalHandler({
        handler: {
          name: 'MemberInvitationEmailHandler',
          handle: (event) => handler.handle(schema.parse(event)),
        },
        store,
        eventType: 'invitation.created',
        eventVersion: 1,
      }),
    ],
  });
}

function workerRegistryEntries(
  handlers: WorkerHandlers,
): readonly [EventRegistryEntry<1>, EventRegistryEntry<1>, EventRegistryEntry<2>] {
  const contactSchema = asEventSchema(contactCreatedEventSchema);
  const tenantV1Schema = asEventSchema(tenantCreatedEventV1Schema);
  const tenantSchema = asEventSchema(tenantCreatedEventSchema);
  return [
    defineEventRegistryEntry({
      eventType: 'contact.created',
      eventVersion: 1,
      schema: contactSchema,
      handlers: [
        bindSideEffectFree('ContactCreatedHandler', contactSchema, 'transient', (event) =>
          handlers.contactCreated.handle(event),
        ),
      ],
    }),
    defineEventRegistryEntry({
      eventType: 'tenant.created',
      eventVersion: 1,
      schema: tenantV1Schema,
      handlers: [
        bindSideEffectFree('TenantCreatedHandler', tenantV1Schema, 'transient', (event) =>
          handlers.tenantCreated.handle(event),
        ),
      ],
    }),
    defineEventRegistryEntry({
      eventType: 'tenant.created',
      eventVersion: 2,
      schema: tenantSchema,
      handlers: [
        bindSideEffectFree('TenantCreatedHandler', tenantSchema, 'transient', (event) =>
          handlers.tenantCreated.handle(event),
        ),
      ],
    }),
  ];
}

/**
 * Records success after `handle`.
 * A provider failure stays retryable because no `processed_events` row is written.
 */
export function defineConfirmedExternalHandler(
  input: ExternalHandlerInput,
): ExternalSideEffectHandler {
  return {
    handler: input.handler,
    retryClassification: input.retryClassification ?? 'idempotent-side-effect',
    hasExternalSideEffect: true,
    delivery: bindConfirmedDelivery(input.handler, input.store, {
      eventType: input.eventType,
      eventVersion: input.eventVersion,
    }),
  };
}

/** Binds an external handler to a reservation taken before the call. */
export function defineExternalHandler(input: ExternalHandlerInput): ExternalSideEffectHandler {
  return {
    handler: input.handler,
    retryClassification: input.retryClassification ?? 'idempotent-side-effect',
    hasExternalSideEffect: true,
    delivery: bindIdempotentDelivery(input.handler, input.store, {
      eventType: input.eventType,
      eventVersion: input.eventVersion,
    }),
  };
}

/** Rejects an external side effect that is not bound to the durable reservation store. */
export function assertHandlerIdempotency(handler: HandlerIdempotencyShape): void {
  if (!handler.hasExternalSideEffect || isDurableDelivery(handler.delivery)) {
    return;
  }
  const name = handler.handler?.name ?? handler.name ?? 'unknown';
  throw new Error(`Handler ${name} has an external side effect without durable idempotency`);
}

function bindSideEffectFree<T>(
  name: string,
  schema: EventSchema<T>,
  retryClassification: RetryClassification,
  handle: (event: T) => Promise<void>,
): SideEffectFreeHandler {
  return {
    retryClassification,
    hasExternalSideEffect: false,
    handler: {
      name,
      async handle(event: unknown): Promise<void> {
        await handle(parseRegisteredEvent(schema, event, name));
      },
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
