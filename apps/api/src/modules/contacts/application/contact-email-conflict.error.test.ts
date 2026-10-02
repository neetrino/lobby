import { describe, expect, it } from 'vitest';

import { isContactEmailConflict } from './contact-email-conflict.error';

const emailIndex = 'contacts_tenant_id_email_key';

describe('isContactEmailConflict', () => {
  it('accepts the Prisma 7 contacts email index', () => {
    expect(isContactEmailConflict(prisma7(emailIndex))).toBe(true);
  });

  it('accepts tenant and email columns when the table is contacts', () => {
    expect(
      isContactEmailConflict({
        code: 'P2002',
        meta: {
          driverAdapterError: {
            cause: {
              constraint: { fields: ['tenant_id', 'email'] },
              table: 'contacts',
            },
          },
        },
      }),
    ).toBe(true);
  });

  it('accepts a classic meta.target for the same constraint', () => {
    expect(
      isContactEmailConflict({
        code: 'P2002',
        meta: { modelName: 'Contact', target: ['tenantId', 'email'] },
      }),
    ).toBe(true);
    expect(
      isContactEmailConflict({
        code: 'P2002',
        meta: { target: emailIndex },
      }),
    ).toBe(true);
  });

  it('rejects other unique constraints and unrelated errors', () => {
    expect(isContactEmailConflict(prisma7('contacts_id_tenant_id_key'))).toBe(false);
    expect(isContactEmailConflict(prisma7('users_tenant_id_email_key'))).toBe(false);
    expect(
      isContactEmailConflict({
        code: 'P2002',
        meta: { modelName: 'Contact', target: ['id', 'tenantId'] },
      }),
    ).toBe(false);
    expect(
      isContactEmailConflict({
        code: 'P2002',
        meta: { modelName: 'User', target: ['tenantId', 'email'] },
      }),
    ).toBe(false);
    expect(isContactEmailConflict({ code: 'P2002' })).toBe(false);
    expect(isContactEmailConflict({ code: 'P2003', meta: { target: emailIndex } })).toBe(false);
    expect(isContactEmailConflict(null)).toBe(false);
  });
});

function prisma7(index: string): { code: 'P2002'; meta: unknown } {
  return {
    code: 'P2002',
    meta: {
      modelName: 'Contact',
      driverAdapterError: {
        cause: {
          kind: 'UniqueConstraintViolation',
          constraint: { index },
          table: 'contacts',
        },
      },
    },
  };
}
