import type { ProcessedEventKey, ProcessedEventStore } from './processed-event-store.js';
import { PermanentDispatchError } from './retry-classification.js';

type DeliveredHandler = {
  readonly name: string;
  handle(event: unknown): Promise<void>;
};

const DURABLE_DELIVERY = Symbol('lobby.durableDelivery');

export type DeliveryIdentity = {
  readonly eventType: string;
  readonly eventVersion: number;
};

/** Only `bindIdempotentDelivery` can construct this. Registration rejects a plain handler. */
export type DurableDelivery = {
  readonly [DURABLE_DELIVERY]: true;
  run(event: unknown): Promise<void>;
};

export function isDurableDelivery(value: unknown): value is DurableDelivery {
  return isRecord(value) && DURABLE_DELIVERY in value && typeof value.run === 'function';
}

/**
 * Reserve-before-send.
 * The reservation commits in its own transaction before `handle`.
 * A duplicate key skips the effect. A crash after `handle` still leaves the row, so a retry does not send again.
 * If `handle` dies after the provider accepted the call, or before it did, the reservation is kept:
 * the effect is at-most-once and is not eligible for automatic retry.
 */
export function bindIdempotentDelivery(
  handler: DeliveredHandler,
  store: ProcessedEventStore,
  identity: DeliveryIdentity,
): DurableDelivery {
  return {
    [DURABLE_DELIVERY]: true,
    run(event: unknown): Promise<void> {
      return deliverOnce(handler, store, identity, event);
    },
  };
}

/**
 * Send, then record.
 * A failed `handle` leaves no row, so the outbox retry calls the provider again.
 * The provider must dedupe with its own idempotency key when a crash lands between those two steps.
 */
export function bindConfirmedDelivery(
  handler: DeliveredHandler,
  store: ProcessedEventStore,
  identity: DeliveryIdentity,
): DurableDelivery {
  return {
    [DURABLE_DELIVERY]: true,
    run(event: unknown): Promise<void> {
      return deliverAfterSuccess(handler, store, identity, event);
    },
  };
}

async function deliverAfterSuccess(
  handler: DeliveredHandler,
  store: ProcessedEventStore,
  identity: DeliveryIdentity,
  event: unknown,
): Promise<void> {
  const key = reservationKey(handler.name, identity, event);
  if (await store.isProcessed(key)) {
    return;
  }
  await handler.handle(event);
  await store.tryReserve(key);
}

async function deliverOnce(
  handler: DeliveredHandler,
  store: ProcessedEventStore,
  identity: DeliveryIdentity,
  event: unknown,
): Promise<void> {
  const key = reservationKey(handler.name, identity, event);
  const reserved = await store.tryReserve(key);
  if (!reserved) {
    return;
  }
  await handler.handle(event);
}

function reservationKey(
  handlerName: string,
  identity: DeliveryIdentity,
  event: unknown,
): ProcessedEventKey {
  return {
    handlerName,
    eventType: identity.eventType,
    eventVersion: identity.eventVersion,
    eventId: readEventId(event),
  };
}

function readEventId(event: unknown): string {
  if (!isRecord(event) || typeof event.eventId !== 'string' || event.eventId.length === 0) {
    throw new PermanentDispatchError('Dispatched event is missing eventId');
  }
  return event.eventId;
}

function isRecord(value: unknown): value is Record<string, unknown> & object {
  return typeof value === 'object' && value !== null;
}
