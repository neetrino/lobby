import { afterAll, describe, expect, it } from 'vitest';

import {
  createTestPrismaClient,
  disposeTestPrismaClient,
  isDuplicateDatabaseError,
  type PrismaClient,
} from './create-test-database';

const clients: PrismaClient[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => disposeTestPrismaClient(client)));
});

describe('duplicate database errors', () => {
  it('treats a concurrent catalog insert as an existing database', () => {
    expect(
      isDuplicateDatabaseError({
        code: '23505',
        constraint: 'pg_database_datname_index',
      }),
    ).toBe(true);
    expect(isDuplicateDatabaseError({ code: '42P04' })).toBe(true);
    expect(isDuplicateDatabaseError({ code: '23505', constraint: 'users_email_key' })).toBe(false);
  });
});

describe('isolated test database clients', () => {
  it('lets concurrent clients use the same unique values without sharing rows', async () => {
    const [first, second] = await Promise.all([createTestPrismaClient(), createTestPrismaClient()]);
    clients.push(first, second);

    await Promise.all([
      first.tenant.create({ data: { name: 'First', subdomain: 'same', plan: 'STARTER' } }),
      second.tenant.create({ data: { name: 'Second', subdomain: 'same', plan: 'STARTER' } }),
    ]);

    expect(await first.tenant.count()).toBe(1);
    expect(await second.tenant.count()).toBe(1);
  }, 60_000);
});
