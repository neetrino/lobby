import { describe, expect, it } from 'vitest';

import {
  TENANT_CREATED_EVENT_VERSION,
  contactCreatedEventSchema,
  defaultLocale,
  localeSchema,
  moduleKeySchema,
  passwordHashSchema,
  tenantCreatedEventSchema,
  tenantCreatedEventV1Schema,
} from './index.js';

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

describe('tenantCreatedEventSchema', () => {
  const ownerUserId = '33333333-3333-4333-8333-333333333333';
  const validTenantCreatedEvent = {
    ...validContactCreatedEvent,
    eventType: 'tenant.created',
    eventVersion: TENANT_CREATED_EVENT_VERSION,
    aggregateType: 'tenant',
    payload: {
      name: 'Acme',
      subdomain: 'acme',
      plan: 'starter',
      ownerUserId,
    },
  };

  it('accepts the tenant and its owner without credentials', () => {
    const result = tenantCreatedEventSchema.safeParse(validTenantCreatedEvent);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.payload.ownerUserId).toBe(ownerUserId);
      expect(result.data.eventVersion).toBe(2);
      expect(JSON.stringify(result.data.payload)).not.toContain('password');
    }
  });

  it('rejects a credential, an old owner field, and an unsupported plan', () => {
    const withHash = tenantCreatedEventSchema.safeParse({
      ...validTenantCreatedEvent,
      payload: { ...validTenantCreatedEvent.payload, passwordHash: 'secret' },
    });
    const oldField = tenantCreatedEventSchema.safeParse({
      ...validTenantCreatedEvent,
      payload: { name: 'Acme', subdomain: 'acme', plan: 'starter', userId: ownerUserId },
    });
    const oldVersion = tenantCreatedEventSchema.safeParse({
      ...validTenantCreatedEvent,
      eventVersion: 1,
    });
    const unsupportedPlan = tenantCreatedEventSchema.safeParse({
      ...validTenantCreatedEvent,
      payload: { ...validTenantCreatedEvent.payload, plan: 'professional' },
    });

    expect(withHash.success).toBe(false);
    expect(oldField.success).toBe(false);
    expect(oldVersion.success).toBe(false);
    expect(unsupportedPlan.success).toBe(false);
  });

  it('still accepts an unpublished version 1 event', () => {
    const result = tenantCreatedEventV1Schema.safeParse({
      ...validContactCreatedEvent,
      eventType: 'tenant.created',
      eventVersion: 1,
      aggregateType: 'tenant',
      payload: {
        name: 'Acme',
        subdomain: 'acme',
        plan: 'starter',
        userId: '33333333-3333-4333-8333-333333333333',
      },
    });

    expect(result.success).toBe(true);
  });
});

describe('passwordHashSchema', () => {
  it('accepts an Argon2id hash and rejects a non-hash', () => {
    const argon2id =
      '$argon2id$v=19$m=65536,p=4,t=3$PEbBsUzxZ+rLvTW4czR4Ww$GiSsH9i7n0l40OGimI/KV+2Gf6GNJvf5MiPpVuIqXb8';

    expect(passwordHashSchema.safeParse(argon2id).success).toBe(true);
    expect(passwordHashSchema.safeParse('md5-placeholder').success).toBe(false);
    expect(passwordHashSchema.safeParse('plaintext-password').success).toBe(false);
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
