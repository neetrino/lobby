import { createTestPrismaClient, type PrismaClient } from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
});

afterAll(async () => {
  await clearReservationData();
  await prisma?.$disconnect();
});

beforeEach(async () => {
  await clearReservationData();
});

describe('reservation database constraints', () => {
  it('rejects overlapping active assignments for the same table', async () => {
    const { tenant, venue, table } = await createVenueWithTable('overlap');
    const first = await createReservation(tenant.id, venue.id, '18:00', '19:30');
    const second = await createReservation(tenant.id, venue.id, '19:00', '20:00');

    await prisma.reservationTable.create({
      data: assignment(tenant.id, venue.id, first.id, table.id, '18:00', '19:30'),
    });

    await expect(
      prisma.reservationTable.create({
        data: assignment(tenant.id, venue.id, second.id, table.id, '19:00', '20:00'),
      }),
    ).rejects.toThrow();
  });

  it('allows adjacent reservations because availability ranges are half-open', async () => {
    const { tenant, venue, table } = await createVenueWithTable('adjacent');
    const first = await createReservation(tenant.id, venue.id, '18:00', '19:30');
    const second = await createReservation(tenant.id, venue.id, '19:30', '20:30');

    await prisma.reservationTable.create({
      data: assignment(tenant.id, venue.id, first.id, table.id, '18:00', '19:30'),
    });

    await expect(
      prisma.reservationTable.create({
        data: assignment(tenant.id, venue.id, second.id, table.id, '19:30', '20:30'),
      }),
    ).resolves.toBeDefined();
  });

  it('rejects a table from another venue even inside the same tenant', async () => {
    const first = await createVenueWithTable('venue-a');
    const second = await createVenueWithTableForTenant(first.tenant.id, 'venue-b');
    const reservation = await createReservation(first.tenant.id, first.venue.id, '18:00', '19:30');

    await expect(
      prisma.reservationTable.create({
        data: assignment(
          first.tenant.id,
          first.venue.id,
          reservation.id,
          second.table.id,
          '18:00',
          '19:30',
        ),
      }),
    ).rejects.toThrow();
  });
});

async function createVenueWithTable(subdomain: string) {
  const tenant = await prisma.tenant.create({
    data: { name: subdomain, subdomain, plan: 'STARTER' },
  });
  const { venue, table } = await createVenueWithTableForTenant(tenant.id, subdomain);
  return { tenant, venue, table };
}

async function createVenueWithTableForTenant(tenantId: string, name: string) {
  const venue = await prisma.venue.create({
    data: { tenantId, name, timezone: 'Asia/Yerevan' },
  });
  const area = await prisma.diningArea.create({
    data: { tenantId, venueId: venue.id, name: 'Main hall' },
  });
  const table = await prisma.restaurantTable.create({
    data: {
      tenantId,
      venueId: venue.id,
      diningAreaId: area.id,
      label: 'T1',
      minimumCapacity: 1,
      maximumCapacity: 4,
    },
  });
  return { venue, table };
}

function createReservation(tenantId: string, venueId: string, start: string, end: string) {
  return prisma.reservation.create({
    data: {
      tenantId,
      venueId,
      startsAt: at(start),
      endsAt: at(end),
      partySize: 2,
      customerName: 'Test guest',
    },
  });
}

function assignment(
  tenantId: string,
  venueId: string,
  reservationId: string,
  tableId: string,
  start: string,
  end: string,
) {
  return {
    tenantId,
    venueId,
    reservationId,
    tableId,
    startsAt: at(start),
    endsAt: at(end),
  };
}

function at(time: string): Date {
  return new Date(`2026-10-01T${time}:00.000Z`);
}

async function clearReservationData(): Promise<void> {
  if (!prisma) return;
  await prisma.reservationStatusHistory.deleteMany();
  await prisma.reservationTable.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.servicePeriod.deleteMany();
  await prisma.restaurantTable.deleteMany();
  await prisma.diningArea.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.tenant.deleteMany();
}
