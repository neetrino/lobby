import {
  createTestPrismaClient,
  disposeTestPrismaClient,
  type PrismaClient,
} from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { clearTestTenantData } from '../../../testing/clear-test-tenant-data';

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
});

afterAll(async () => {
  await clearTestTenantData(prisma);
  await disposeTestPrismaClient(prisma);
});

beforeEach(async () => {
  await clearTestTenantData(prisma);
});

describe('reservation database constraints', () => {
  it('rejects overlapping active bookings for the same table', async () => {
    const { tenant, location, table } = await createLocationWithTable('overlap');
    await book(tenant.id, location.id, table.id, '18:00', '19:30');

    await expect(book(tenant.id, location.id, table.id, '19:00', '20:00')).rejects.toThrow();
  });

  it('allows adjacent bookings because the range is half-open', async () => {
    const { tenant, location, table } = await createLocationWithTable('adjacent');
    await book(tenant.id, location.id, table.id, '18:00', '19:30');

    await expect(book(tenant.id, location.id, table.id, '19:30', '20:30')).resolves.toBeDefined();
  });

  it('allows an overlapping booking after the first one is cancelled', async () => {
    const { tenant, location, table } = await createLocationWithTable('cancelled');
    const first = await book(tenant.id, location.id, table.id, '18:00', '19:30');
    await prisma.reservation.update({ where: { id: first.id }, data: { status: 'CANCELLED' } });

    await expect(book(tenant.id, location.id, table.id, '18:30', '19:00')).resolves.toBeDefined();
  });

  it('rejects a table from another location in the same tenant', async () => {
    const first = await createLocationWithTable('location-a');
    const second = await createLocationWithTableForTenant(first.tenant.id, 'location-b');

    await expect(book(first.tenant.id, first.location.id, second.table.id, '18:00', '19:30')).rejects.toThrow();
  });
});

async function createLocationWithTable(subdomain: string) {
  const tenant = await prisma.tenant.create({
    data: { name: subdomain, subdomain, plan: 'STARTER' },
  });
  const { location, table } = await createLocationWithTableForTenant(tenant.id, subdomain);
  return { tenant, location, table };
}

async function createLocationWithTableForTenant(tenantId: string, name: string) {
  const location = await prisma.reservationLocation.create({
    data: { tenantId, name, timezone: 'Asia/Yerevan' },
  });
  const table = await prisma.reservationTable.create({
    data: { tenantId, locationId: location.id, name: 'T1', minCapacity: 1, capacity: 4 },
  });
  return { location, table };
}

function book(tenantId: string, locationId: string, tableId: string, start: string, end: string) {
  return prisma.reservation.create({
    data: {
      tenantId,
      locationId,
      tableId,
      source: 'STAFF',
      guestCount: 2,
      customerName: 'Test guest',
      customerPhone: '+37400000000',
      startsAt: at(start),
      endsAt: at(end),
    },
  });
}

function at(time: string): Date {
  return new Date(`2026-10-01T${time}:00.000Z`);
}
