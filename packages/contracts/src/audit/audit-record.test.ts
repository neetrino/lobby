import { describe, expect, it } from 'vitest';

import { auditActions, auditSchemaVersion, userSessionsTerminatedAuditSchema } from './index.js';

const success = {
  tenantId: '22222222-2222-4222-8222-222222222222',
  actorUserId: '11111111-1111-4111-8111-111111111111',
  actorRole: 'ADMIN',
  actorType: 'USER',
  action: auditActions.USER_SESSIONS_TERMINATED,
  resourceType: 'user',
  resourceId: '33333333-3333-4333-8333-333333333333',
  outcome: 'SUCCESS',
  changes: { authenticationVersion: { from: 3, to: 4 } },
  reason: null,
  requestId: '44444444-4444-4444-8444-444444444444',
  ipHash: 'a'.repeat(64),
  userAgent: 'Mozilla/5.0',
  schemaVersion: auditSchemaVersion,
} as const;

describe('userSessionsTerminatedAuditSchema', () => {
  it('accepts a successful version change and a denial without changes', () => {
    expect(userSessionsTerminatedAuditSchema.safeParse(success).success).toBe(true);
    expect(
      userSessionsTerminatedAuditSchema.safeParse({ ...success, outcome: 'DENIED', changes: null }).success,
    ).toBe(true);
  });

  it('rejects secrets, a raw ip, and a success row without the version change', () => {
    expect(
      userSessionsTerminatedAuditSchema.safeParse({
        ...success,
        changes: { passwordHash: { from: 'old', to: 'new' } },
      }).success,
    ).toBe(false);
    expect(userSessionsTerminatedAuditSchema.safeParse({ ...success, ipHash: '203.0.113.5' }).success).toBe(false);
    expect(userSessionsTerminatedAuditSchema.safeParse({ ...success, changes: null }).success).toBe(false);
    expect(userSessionsTerminatedAuditSchema.safeParse({ ...success, action: 'user.deleted' }).success).toBe(false);
  });
});