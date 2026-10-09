import { describe, expect, it } from 'vitest';

import { parseRequeueArgs } from './requeue-command.js';

describe('requeue command', () => {
  it('parses one event id', () => {
    expect(parseRequeueArgs(['--id', '11111111-1111-4111-8111-111111111111'])).toEqual({
      kind: 'id',
      id: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('parses an eventType@eventVersion group', () => {
    expect(parseRequeueArgs(['--event', 'contact.created@1'])).toEqual({
      kind: 'event',
      eventType: 'contact.created',
      eventVersion: 1,
    });
  });

  it('rejects a command the poll loop must not invent', () => {
    expect(() => parseRequeueArgs([])).toThrow(
      'Usage: requeue --id <eventId> | requeue --event <eventType@eventVersion>',
    );
    expect(() => parseRequeueArgs(['--id', 'not-a-uuid'])).toThrow(
      'Requeue --id expects an outbox event UUID',
    );
    expect(() => parseRequeueArgs(['--event', 'contact.created'])).toThrow(
      'Requeue --event expects eventType@eventVersion',
    );
  });
});
