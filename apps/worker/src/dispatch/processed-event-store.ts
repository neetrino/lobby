/** Identity of one handler invocation. The database unique key uses the same fields. */
export type ProcessedEventKey = {
  readonly handlerName: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly eventId: string;
};

/**
 * Durable reservation store.
 * `tryReserve` commits before the caller performs an external side effect.
 */
export type ProcessedEventStore = {
  tryReserve(key: ProcessedEventKey): Promise<boolean>;
};

/** In-memory stand-in for tests. A new delivery object can share this store across a simulated restart. */
export class MemoryProcessedEventStore implements ProcessedEventStore {
  private readonly reserved = new Set<string>();

  async tryReserve(key: ProcessedEventKey): Promise<boolean> {
    const id = reservationId(key);
    if (this.reserved.has(id)) {
      return false;
    }
    this.reserved.add(id);
    return true;
  }
}

function reservationId(key: ProcessedEventKey): string {
  return `${key.handlerName}\0${key.eventType}\0${key.eventVersion}\0${key.eventId}`;
}
