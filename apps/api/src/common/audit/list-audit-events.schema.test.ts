import { describe, expect, it } from 'vitest';

import { DEFAULT_PAGE_LIMIT } from '@lobby/contracts';

import { scopedTenantId } from '../auth/authorization';
import { decodeCursor } from '../pagination';
import { requestContextFromSession } from '../tenant/request-context';
import { auditEventListWhere, auditEventOrderBy } from './list-audit-events.query';
import { auditEventListQuerySchema, encodeAuditEventCursor } from './list-audit-events.schema';

const position = {
  occurredAt: '2026-01-02T00:00:00.000Z',
  id: '20000000-0000-4000-8000-000000000002',
};

describe('auditEventListQuerySchema', () => {
  it('defaults the page to 50 rows ordered by occurredAt descending', () => {
    expect(auditEventListQuerySchema.parse({})).toEqual({
      limit: DEFAULT_PAGE_LIMIT,
      sort: 'desc',
    });
  });

  it('accepts the audit allowlist and rejects a client column or an unknown key', () => {
    const filters = {
      limit: '2',
      sort: 'asc',
      action: 'user.sessions.terminated',
      outcome: 'SUCCESS',
      actorUserId: '10000000-0000-4000-8000-000000000001',
      resourceType: 'user',
      resourceId: '10000000-0000-4000-8000-000000000001',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-03T00:00:00.000Z',
    };
    const parsed = auditEventListQuerySchema.parse({
      ...filters,
      cursor: encodeAuditEventCursor(position, auditEventListQuerySchema.parse(filters)),
    });

    expect(parsed.limit).toBe(2);
    expect(parsed.sort).toBe('asc');
    expect(parsed.cursor).toMatchObject({ ...position, sort: 'asc' });
    expect(parsed.cursor?.filterFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.cursor).not.toHaveProperty('action');
    expect(auditEventListQuerySchema.safeParse({ orderBy: { occurredAt: 'desc' } }).success).toBe(
      false,
    );
    expect(auditEventListQuerySchema.safeParse({ sort: 'occurredAt' }).success).toBe(false);
    expect(auditEventListQuerySchema.safeParse({ page: '10' }).success).toBe(false);
    expect(auditEventListQuerySchema.safeParse({ tenantId: position.id }).success).toBe(false);
    expect(auditEventListQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(
      auditEventListQuerySchema.safeParse({
        from: position.occurredAt,
        to: '2026-01-01T00:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('rejects a cursor whose filters or sort differ and allows a new limit', () => {
    const disabled = auditEventListQuerySchema.parse({ action: 'user.disabled', limit: '20' });
    const encoded = encodeAuditEventCursor(position, disabled);
    const decoded = decodeCursor(encoded);
    const extra = Buffer.from(
      JSON.stringify({ ...(decoded as Record<string, unknown>), tenantId: position.id }),
      'utf8',
    ).toString('base64url');
    const legacy = Buffer.from(JSON.stringify({ ...position, sort: 'desc' }), 'utf8').toString(
      'base64url',
    );

    expect(
      auditEventListQuerySchema.parse({ action: 'user.disabled', limit: '50', cursor: encoded })
        .limit,
    ).toBe(50);
    expect(
      auditEventListQuerySchema.safeParse({ action: 'contact.deleted', cursor: encoded }).success,
    ).toBe(false);
    expect(auditEventListQuerySchema.safeParse({ cursor: encoded, sort: 'asc' }).success).toBe(
      false,
    );
    expect(auditEventListQuerySchema.safeParse({ cursor: legacy }).success).toBe(false);
    expect(auditEventListQuerySchema.safeParse({ cursor: extra }).success).toBe(false);
    expect(auditEventListQuerySchema.safeParse({ cursor: 'not-a-cursor' }).success).toBe(false);
  });
});

describe('audit event list query', () => {
  it('keeps tenant scope and occurredAt ordering inside the query', () => {
    const tenantId = scopedTenantId(
      requestContextFromSession(
        {
          userId: '10000000-0000-4000-8000-000000000001',
          tenantId: '10000000-0000-4000-8000-000000000099',
          role: 'OWNER',
        },
        '44444444-4444-4444-8444-444444444444',
      ),
    );
    const query = auditEventListQuerySchema.parse({ action: 'user.disabled' });
    const where = auditEventListWhere(tenantId, query);

    expect(where.tenantId).toBe(tenantId);
    expect(where.action).toBe('user.disabled');
    expect(auditEventOrderBy('desc')).toEqual([{ occurredAt: 'desc' }, { id: 'desc' }]);
    expect(auditEventOrderBy('asc')).toEqual([{ occurredAt: 'asc' }, { id: 'asc' }]);
  });
});
