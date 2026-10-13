/** Identity of one handler invocation. The database unique key uses the same fields. */
export type ProcessedEventKey = {
  readonly handlerName: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly eventId: string;
};

/**
 * Durable record that an external effect must not run again.
 * `tryReserve` inserts the row. `isProcessed` only reads it.
 */
export type ProcessedEventStore = {
  tryReserve(key: ProcessedEventKey): Promise<boolean>;
  isProcessed(key: ProcessedEventKey): Promise<boolean>;
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

  async isProcessed(key: ProcessedEventKey): Promise<boolean> {
    return this.reserved.has(reservationId(key));
  }
}

function reservationId(key: ProcessedEventKey): string {
  return `${key.handlerName}\0${key.eventType}\0${key.eventVersion}\0${key.eventId}`;
}
