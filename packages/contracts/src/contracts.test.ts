import { describe, expect, it } from 'vitest';

import { contactCreatedEventSchema, defaultLocale, localeSchema, moduleKeySchema } from './index.js';

const validContactCreatedEvent = {
  eventId: '11111111-1111-4111-8111-111111111111',
  eventType: 'contact.created',
  eventVersion: 1,
  tenantId: '22222222-2222-4222-8222-222222222222',
  aggregateType: 'contact',
  aggregateId: '33333333-3333-4333-8333-333333333333',
  occurredAt: '2026-09-25T09:00:00.000Z',
  payload: { name: 'Ada' },
} as const;

describe('contactCreatedEventSchema', () => {
  it('accepts a valid contact-created event', () => {
    expect(contactCreatedEventSchema.safeParse(validContactCreatedEvent).success).toBe(true);
  });

  it('rejects an invalid UUID', () => {
    const result = contactCreatedEventSchema.safeParse({
      ...validContactCreatedEvent,
      eventId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an invalid datetime', () => {
    const dateOnly = contactCreatedEventSchema.safeParse({
      ...validContactCreatedEvent,
      occurredAt: '2026-09-25',
    });
    const nonUtc = contactCreatedEventSchema.safeParse({
      ...validContactCreatedEvent,
      occurredAt: '2026-09-25T13:00:00+04:00',
    });

    expect(dateOnly.success).toBe(false);
    expect(nonUtc.success).toBe(false);
  });

  it('rejects a missing or non-positive event version', () => {
    const { eventVersion: _omitted, ...missingVersion } = validContactCreatedEvent;
    const missing = contactCreatedEventSchema.safeParse(missingVersion);
    const zero = contactCreatedEventSchema.safeParse({
      ...validContactCreatedEvent,
      eventVersion: 0,
    });
    const negative = contactCreatedEventSchema.safeParse({
      ...validContactCreatedEvent,
      eventVersion: -1,
    });

    expect(missing.success).toBe(false);
    expect(zero.success).toBe(false);
    expect(negative.success).toBe(false);
  });
});

describe('moduleKeySchema', () => {
  it('rejects an unsupported module key', () => {
    expect(moduleKeySchema.safeParse('messenger').success).toBe(false);
  });
});

describe('localeSchema', () => {
  it('accepts launch locales and falls back to English', () => {
    expect(localeSchema.safeParse('hy').success).toBe(true);
    expect(localeSchema.safeParse('ru').success).toBe(true);
    expect(localeSchema.safeParse('en').success).toBe(true);
    expect(localeSchema.safeParse('fr').success).toBe(false);
    expect(defaultLocale).toBe('en');
  });
});
