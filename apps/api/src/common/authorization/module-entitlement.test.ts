import { describe, expect, it } from 'vitest';

import { AuthorizationError } from '../auth/authorization';
import { requestContextFromSession } from '../tenant/request-context';
import { isModuleEnabled, moduleEntitlements, requireModule } from './module-entitlement';

describe('module entitlement', () => {
  it('enables contacts for a session tenant', () => {
    expect(moduleEntitlements.contacts).toBe('enabled');
    expect(() => requireModule(actor('tenant-a'), 'contacts')).not.toThrow();
  });

  it('rejects a disabled module before the action permission matters', () => {
    expect(isModuleEnabled('contacts', { contacts: 'disabled' })).toBe(false);
  });

  it('rejects an empty tenant', () => {
    expect(() => requireModule(actor(''), 'contacts')).toThrow(AuthorizationError);
  });
});

function actor(tenantId: string) {
  return requestContextFromSession(
    { tenantId, userId: '11111111-1111-4111-8111-111111111111', role: 'MEMBER' },
    '55555555-5555-4555-8555-555555555555',
  );
}
