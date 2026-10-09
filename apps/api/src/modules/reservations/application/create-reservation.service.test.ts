import { createTestPrismaClient, disposeTestPrismaClient, type PrismaClient } from '@lobby/database/testing';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuditEventStore } from '../../../common/audit/audit-event.store';
import { AuthorizationError } from '../../../common/auth/authorization';
import { ModuleEntitlementService } from '../../../common/authorization/module-entitlement';
import { OutboxService } from '../../../common/outbox/outbox.service';
import { requestContextFromSession } from '../../../common/tenant/request-context';
import { clearTestTenantData } from '../../../testing/clear-test-tenant-data';
import { ReservationRepository } from '../infrastructure/reservation.repository';
import { CreateReservationService } from './create-reservation.service';
import { whatsappActor } from '../../../../test/whatsapp-reservation-actor';
import { ReservationFailure } from './reservation-errors';
import { ReservationHistoryWriter } from './reservation-history';

const passwordHash =
  '$argon2id$v=19$m=65536,p=4,t=3$PEbBsUzxZ+rLvTW4czR4Ww$GiSsH9i7n0l40OGimI/KV+2Gf6GNJvf5MiPpVuIqXb8';

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

describe('CreateReservationService', () => {
  it('creates a staff reservation with history, audit, and an outbox payload without contact details', async () => {
    const seeded = await seed('staff');
    const created = await build().create(user(seeded), command(seeded));
    const event = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: created.reservation.id } });
    const history = await prisma.reservationStatusHistory.findFirstOrThrow();
    const audit = await prisma.auditEvent.findFirstOrThrow();

    expect(created.replayed).toBe(false);
    expect(created.reservation.status).toBe('PENDING');
    expect(history.toStatus).toBe('PENDING');
    expect(audit.action).toBe('reservation.created');
    expect(JSON.stringify(event.payload)).not.toMatch(/phone|email|note/i);
  });

  it('hides another tenant location, table, contact, and user', async () => {
    const owner = await seed('owner');
    const other = await seed('other');
    const service = build();
    const contact = await prisma.contact.create({
      data: {
        tenantId: other.tenant.id,
        name: 'Other',
        type: 'PERSON',
        createdByUserId: other.user.id,
        ownerUserId: other.user.id,
      },
    });

    await expect(service.create(user(owner), command(owner, { locationId: other.location.id }))).rejects.toMatchObject({ code: 'RESERVATION_LOCATION_NOT_FOUND' });
    await expect(service.create(user(owner), command(owner, { requestedTableId: other.table.id }))).rejects.toMatchObject({ code: 'RESERVATION_TABLE_NOT_FOUND' });
    await expect(service.create(user(owner), command(owner, { customer: { name: 'Anna', phone: '+37400000000', contactId: contact.id } }))).rejects.toMatchObject({ code: 'RESERVATION_CONTACT_NOT_FOUND' });
    await expect(service.create(user(owner), command(owner, { assignedUserId: other.user.id }))).rejects.toMatchObject({ code: 'RESERVATION_ASSIGNEE_NOT_FOUND' });
  });

  it('rejects an inactive location or table and a party larger than the table', async () => {
    const seeded = await seed('inactive');
    await prisma.reservationLocation.update({ where: { id: seeded.location.id }, data: { status: 'INACTIVE' } });
    await expect(build().create(user(seeded), command(seeded))).rejects.toMatchObject({ code: 'RESERVATION_LOCATION_NOT_FOUND' });
    await prisma.reservationLocation.update({ where: { id: seeded.location.id }, data: { status: 'ACTIVE' } });
    await prisma.reservationTable.update({ where: { id: seeded.table.id }, data: { status: 'INACTIVE' } });
    await expect(build().create(user(seeded), command(seeded))).rejects.toMatchObject({ code: 'RESERVATION_TABLE_NOT_FOUND' });
    await prisma.reservationTable.update({ where: { id: seeded.table.id }, data: { status: 'ACTIVE' } });
    await expect(build().create(user(seeded), command(seeded, { guestCount: 8 }))).rejects.toMatchObject({ code: 'RESERVATION_TABLE_CAPACITY_EXCEEDED' });
  });

  it('rejects a visit outside working hours', async () => {
    const seeded = await seed('hours');
    await prisma.reservationWorkingHours.updateMany({ data: { opensAt: clock(10), closesAt: clock(12) } });
    await expect(build().create(user(seeded), command(seeded))).rejects.toMatchObject({ code: 'RESERVATION_OUTSIDE_WORKING_HOURS' });
    await expect(build().create(user(seeded), command(seeded, { startsAt: '2020-01-01T18:00:00.000Z' }))).rejects.toMatchObject({ code: 'RESERVATION_START_NOT_IN_FUTURE' });
  });

  it('replays the same source request and keeps one row', async () => {
    const seeded = await seed('replay');
    const service = build();
    const body = command(seeded, { source: { type: 'STAFF', accountId: seeded.user.id, externalRequestId: 'req-1' } });
    const first = await service.create(user(seeded), body);
    const second = await service.create(user(seeded), body);

    expect(second.replayed).toBe(true);
    expect(second.reservation.id).toBe(first.reservation.id);
    await expect(service.create(user(seeded), { ...body, guestCount: 3 })).rejects.toMatchObject({
      code: 'RESERVATION_SOURCE_CONFLICT',
    });
    expect(await prisma.reservation.count()).toBe(1);
  });

  it('replays a matching source request after the booking is no longer available', async () => {
    const seeded = await seed('replay-late');
    const contact = await prisma.contact.create({
      data: {
        tenantId: seeded.tenant.id,
        name: 'Anna',
        type: 'PERSON',
        createdByUserId: seeded.user.id,
        ownerUserId: seeded.user.id,
      },
    });
    const body = command(seeded, {
      assignedUserId: seeded.user.id,
      customer: { name: 'Anna', phone: '+37400000000', contactId: contact.id },
      customerNote: 'window',
      source: {
        type: 'STAFF',
        accountId: seeded.user.id,
        externalRequestId: 'req-1',
        conversationId: 'chat-1',
        messageId: 'msg-1',
      },
    });
    const first = await build().create(user(seeded), body);
    await prisma.reservation.update({
      where: { id: first.reservation.id },
      data: {
        customerPhone: '+37400000009',
        startsAt: new Date('2020-01-01T18:00:00.000Z'),
        endsAt: new Date('2020-01-01T19:00:00.000Z'),
      },
    });
    await prisma.reservationLocation.update({ where: { id: seeded.location.id }, data: { status: 'INACTIVE' } });
    await prisma.contact.update({ where: { id: contact.id }, data: { archivedAt: new Date() } });
    const replayed = await build().create(user(seeded), body);

    expect(replayed.replayed).toBe(true);
    expect(replayed.reservation.id).toBe(first.reservation.id);
    await expect(
      build().create(user(seeded), { ...body, customer: { ...body.customer, phone: '+37400000009' } }),
    ).rejects.toMatchObject({ code: 'RESERVATION_SOURCE_CONFLICT' });
    await expect(
      build().create(user(seeded), { ...body, source: { ...body.source, messageId: 'msg-2' } }),
    ).rejects.toMatchObject({ code: 'RESERVATION_SOURCE_CONFLICT' });
    expect(await prisma.reservation.count()).toBe(1);
  });

  it('rejects a staff session that claims a channel idempotency key', async () => {
    const seeded = await seed('source-actor');
    const channelBody = command(seeded, {
      source: { type: 'WHATSAPP', accountId: 'channel-1', externalRequestId: 'req-1' },
    });
    const integration = await whatsappActor(prisma, seeded.tenant.id, randomUUID());

    await expect(build().create(user(seeded), channelBody)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(build().create(integration, command(seeded, { source: { type: 'STAFF' } }))).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    await expect(
      build().create(integration, command(seeded, { source: { type: 'INSTAGRAM', accountId: 'channel-1', externalRequestId: 'req-1' } })),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      build().create(integration, command(seeded, { source: { type: 'WHATSAPP', accountId: 'other', externalRequestId: 'req-2' } })),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(await prisma.reservation.count()).toBe(0);
  });

  it('keeps one reservation when the same source request arrives concurrently', async () => {
    const seeded = await seed('race-source');
    const body = command(seeded, { source: { type: 'WHATSAPP', accountId: 'channel-1', externalRequestId: 'req-1' } });
    const requestId = randomUUID();
    const actor = await whatsappActor(prisma, seeded.tenant.id, requestId);
    const results = await Promise.allSettled([build().create(actor, body), build().create(actor, body)]);
    const fulfilled = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));

    expect(fulfilled).toHaveLength(2);
    expect(fulfilled.map((result) => result.replayed).sort()).toEqual([false, true]);
    expect(fulfilled[0]?.reservation.id).toBe(fulfilled[1]?.reservation.id);
    expect(await prisma.reservation.count()).toBe(1);
    expect((await prisma.reservation.findFirstOrThrow()).sourceAccountId).toBe('channel-1');
    expect((await prisma.reservationSourceRequest.findFirstOrThrow()).sourceAccountId).toBe('channel-1');
    const audit = await prisma.auditEvent.findFirstOrThrow();
    expect(audit).toMatchObject({
      actorType: 'INTEGRATION',
      actorUserId: null,
      actorRole: null,
      tenantId: seeded.tenant.id,
      resourceId: fulfilled[0]?.reservation.id,
      requestId,
      changes: { provider: 'WHATSAPP', sourceAccountId: 'channel-1' },
    });
    expect(JSON.stringify(audit)).not.toMatch(/phone|email|note|token|secret/i);
    expect(await prisma.auditEvent.count()).toBe(1);
  });

  it('lets only one overlapping booking win and allows the next half-open slot', async () => {
    const seeded = await seed('race-table');
    const service = build();
    const results = await Promise.allSettled([
      service.create(user(seeded), command(seeded)),
      service.create(user(seeded), command(seeded, { customer: { name: 'Ben', phone: '+37400000001' } })),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.reservation.count()).toBe(1);

    const next = new Date(seeded.starts.getTime() + 60 * 60_000);
    await expect(service.create(user(seeded), command(seeded, { startsAt: next.toISOString() }))).resolves.toMatchObject({ replayed: false });
    expect(await prisma.reservation.count()).toBe(2);
  });

  it('rolls back the booking when history, audit, or outbox fails', async () => {
    const seeded = await seed('rollback');
    const history = new ReservationHistoryWriter();
    history.appendInitial = () => Promise.reject(new Error('history unavailable'));
    const audit = new AuditEventStore(prisma);
    audit.append = () => Promise.reject(new Error('audit unavailable'));
    const outbox = new OutboxService();
    outbox.enqueue = () => Promise.reject(new Error('outbox unavailable'));

    await expect(build({ history }).create(user(seeded), command(seeded))).rejects.toThrow('history unavailable');
    await expect(build({ audit }).create(user(seeded), command(seeded))).rejects.toThrow('audit unavailable');
    await expect(build({ outbox }).create(user(seeded), command(seeded))).rejects.toThrow('outbox unavailable');
    expect(await prisma.reservation.count()).toBe(0);
    expect(await prisma.reservationStatusHistory.count()).toBe(0);
    expect(await prisma.auditEvent.count()).toBe(0);
    expect(await prisma.outboxEvent.count()).toBe(0);
  });

  it('rejects a disabled reservations module', async () => {
    const seeded = await seed('disabled');
    await prisma.tenantModule.updateMany({ data: { status: 'DISABLED' } });
    await expect(build().create(user(seeded), command(seeded))).rejects.toBeInstanceOf(ReservationFailure);
    await expect(build().create(user(seeded), command(seeded))).rejects.toMatchObject({ code: 'RESERVATION_MODULE_DISABLED' });
  });
});

function build(overrides: {
  history?: ReservationHistoryWriter;
  audit?: AuditEventStore;
  outbox?: OutboxService;
} = {}) {
  return new CreateReservationService(
    new ReservationRepository(prisma),
    overrides.history ?? new ReservationHistoryWriter(),
    overrides.audit ?? new AuditEventStore(prisma),
    overrides.outbox ?? new OutboxService(),
    new ModuleEntitlementService(prisma),
  );
}

function user(seeded: Awaited<ReturnType<typeof seed>>) {
  return { type: 'USER' as const, context: seeded.context };
}

function command(seeded: Awaited<ReturnType<typeof seed>>, overrides: Record<string, unknown> = {}) {
  return {
    locationId: seeded.location.id,
    startsAt: seeded.starts.toISOString(),
    durationMinutes: 60,
    guestCount: 2,
    customer: { name: 'Anna', phone: '+37400000000' },
    requestedTableId: seeded.table.id,
    source: { type: 'STAFF' as const },
    ...overrides,
  };
}

async function seed(name: string) {
  const tenant = await prisma.tenant.create({ data: { name, subdomain: name, plan: 'STARTER' } });
  const userRow = await prisma.user.create({
    data: { tenantId: tenant.id, email: `${name}@example.test`, name: 'Ada', passwordHash, role: 'OWNER' },
  });
  await prisma.tenantModule.create({
    data: { tenantId: tenant.id, moduleKey: 'reservations', status: 'ENABLED' },
  });
  const starts = futureAt(18);
  const location = await prisma.reservationLocation.create({
    data: { tenantId: tenant.id, name: 'Hall', timezone: 'UTC' },
  });
  await prisma.reservationWorkingHours.create({
    data: {
      tenantId: tenant.id,
      locationId: location.id,
      weekday: starts.getUTCDay(),
      opensAt: clock(9),
      closesAt: clock(23),
      isClosed: false,
    },
  });
  const table = await prisma.reservationTable.create({
    data: { tenantId: tenant.id, locationId: location.id, name: 'A1', minCapacity: 1, capacity: 4 },
  });
  const context = requestContextFromSession(
    { tenantId: tenant.id, userId: userRow.id, role: 'OWNER' },
    randomUUID(),
  );
  return { tenant, user: userRow, location, table, context, starts };
}

function futureAt(hour: number): Date {
  const starts = new Date(Date.now() + 10 * 86_400_000);
  starts.setUTCMinutes(0, 0, 0);
  starts.setUTCHours(hour);
  return starts;
}

function clock(hour: number): Date {
  return new Date(Date.UTC(1970, 0, 1, hour, 0, 0));
}
