const EVENT_KEY = /^(.+)@(\d+)$/;
const EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RequeueCommand =
  | { readonly kind: 'id'; readonly id: string }
  | { readonly kind: 'event'; readonly eventType: string; readonly eventVersion: number };

/** Parses a manual requeue invocation. This is not called from the worker poll loop. */
export function parseRequeueArgs(argv: readonly string[]): RequeueCommand {
  if (argv.length !== 2) {
    throw new Error('Usage: requeue --id <eventId> | requeue --event <eventType@eventVersion>');
  }
  const [flag, value] = argv;
  if (flag === '--id') {
    return { kind: 'id', id: readEventId(value) };
  }
  if (flag === '--event') {
    return readEventKey(value);
  }
  throw new Error('Usage: requeue --id <eventId> | requeue --event <eventType@eventVersion>');
}

function readEventId(value: string | undefined): string {
  if (!value || !EVENT_ID.test(value)) {
    throw new Error('Requeue --id expects an outbox event UUID');
  }
  return value;
}

function readEventKey(value: string | undefined): RequeueCommand {
  const match = value ? EVENT_KEY.exec(value) : null;
  const eventVersion = match ? Number(match[2]) : Number.NaN;
  if (!match || !match[1] || !Number.isInteger(eventVersion)) {
    throw new Error('Requeue --event expects eventType@eventVersion');
  }
  return { kind: 'event', eventType: match[1], eventVersion };
}
