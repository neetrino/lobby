import { describe, expect, it } from 'vitest';

import { AuthorizationError } from '../auth/authorization';
import { requestContextFromSession } from '../tenant/request-context';
import { canAccessResource, requireResourceScope } from './resource-scope';

const tenantId = '33333333-3333-4333-8333-333333333333';
const otherTenantId = '44444444-4444-4444-8444-444444444444';
const ownerId = '11111111-1111-4111-8111-111111111111';
const memberId = '22222222-2222-4222-8222-222222222222';

describe('tenant resource scope', () => {
  it('lets every user in the tenant use every contact in that tenant', () => {
    const contact = { tenantId };
    for (const userId of [ownerId, memberId]) {
      const actor = caller(userId, tenantId);
      expect(canAccessResource(actor, 'tenant', contact)).toBe(true);
      expect(() => requireResourceScope(actor, 'tenant', contact)).not.toThrow();
    }
  });

  it('refuses a contact in another tenant and a caller without an id', () => {
    const contact = { tenantId: otherTenantId };
    expect(canAccessResource(caller(ownerId, tenantId), 'tenant', contact)).toBe(false);
    expect(canAccessResource(caller('', tenantId), 'tenant', { tenantId })).toBe(false);
    expect(() => requireResourceScope(caller(ownerId, tenantId), 'tenant', contact)).toThrow(
      AuthorizationError,
    );
  });
});

function caller(userId: string, tenantId: string) {
  return requestContextFromSession(
    { userId, tenantId, role: 'MEMBER' },
    '55555555-5555-4555-8555-555555555555',
  );
}
