import { eventRegistryKey } from './event-registry.js';

export const permanentFailureCodes = [
  'unknown_event',
  'invalid_event',
  'permanent_handler_failure',
] as const;

export type PermanentFailureCode = (typeof permanentFailureCodes)[number];

/** Structured dispatch failure. Payload is intentionally absent. */
export type DispatchLog = {
  level: 'error';
  message: string;
  eventType: string;
  eventVersion: number;
  eventId: string;
  code: PermanentFailureCode;
};

export type DispatchLogger = {
  error(entry: DispatchLog): void;
};

type LogRecord = {
  id: string;
  eventType: string;
  eventVersion: number;
};

/** One JSON line on stderr. Tests can replace the sink. */
export function createDispatchLogger(write: (line: string) => void = writeStderr): DispatchLogger {
  return {
    error(entry: DispatchLog): void {
      write(`${JSON.stringify(entry)}\n`);
    },
  };
}

export function createDispatchLog(record: LogRecord, code: PermanentFailureCode): DispatchLog {
  return {
    level: 'error',
    message: permanentFailureMessage(code, record.eventType, record.eventVersion),
    eventType: record.eventType,
    eventVersion: record.eventVersion,
    eventId: record.id,
    code,
  };
}

export function permanentFailureMessage(
  code: PermanentFailureCode,
  eventType: string,
  eventVersion: number,
): string {
  const key = eventRegistryKey(eventType, eventVersion);
  switch (code) {
    case 'unknown_event':
      return `Unknown event ${key}`;
    case 'invalid_event':
      return `Invalid event payload for ${key}`;
    case 'permanent_handler_failure':
      return `Permanent handler failure for ${key}`;
    default:
      return assertNever(code);
  }
}

export function isPermanentFailureCode(value: unknown): value is PermanentFailureCode {
  return typeof value === 'string' && permanentFailureCodes.some((code) => code === value);
}

function writeStderr(line: string): void {
  process.stderr.write(line);
}

function assertNever(value: never): never {
  throw new Error(`Unexpected permanent failure code: ${String(value)}`);
}
