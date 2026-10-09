import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };
import type { ReservationSource } from '@lobby/contracts';

import { scopedTenantId } from '../../../common/auth/authorization';
import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import type { TenantId } from '../../../common/tenant/tenant-id';
import { clockMinutes } from '../domain/reservation-hours';
import type { ReservationActor } from '../application/reservation-actor';
import { reservationListFilter, reservationListOrder } from '../application/list-reservations.query';
import type { ReservationListQuery } from '../application/list-reservations.schema';
import {
  findStoredSourceRequest,
  insertStoredSourceRequest,
  lockStoredSourceRequest,
  reservationSelect,
} from './reservation-source-request';

const BLOCKING = ['PENDING', 'CONFIRMED', 'ARRIVED', 'SEATED'] as const;

export type LocationRecord = { id: string; timezone: string; status: 'ACTIVE' | 'INACTIVE' };

export type TableRecord = {
  id: string;
  locationId: string;
  minCapacity: number;
  capacity: number;
  status: 'ACTIVE' | 'INACTIVE';
  archivedAt: Date | null;
};

export type ReservationRecord = {
  id: string;
  locationId: string;
  tableId: string | null;
  contactId: string | null;
  assignedUserId: string | null;
  source: ReservationSource;
  guestCount: number;
  startsAt: Date;
  endsAt: Date;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  customerNote: string | null;
  sourceAccountId: string | null;
  sourceRequestId: string | null;
  sourceConversationId: string | null;
  sourceMessageId: string | null;
  status: string;
};

export type HoursWindow = { closed: boolean; opensMinute: number; closesMinute: number };

export type AvailabilityInput = {
  locationId: string;
  startsAt: Date;
  endsAt: Date;
  guestCount: number;
};

export type StoredSourceRequest = {
  reservation: ReservationRecord;
  requestFingerprint: string;
};

export type SourceIdentity = {
  source: ReservationSource;
  sourceAccountId: string;
  externalRequestId: string;
};

export type ReservationInsert = {
  locationId: string;
  tableId: string;
  contactId: string | null;
  assignedUserId: string | null;
  createdByUserId: string | null;
  source: ReservationSource;
  guestCount: number;
  startsAt: Date;
  endsAt: Date;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  customerNote: string | null;
  sourceAccountId: string | null;
  sourceRequestId: string | null;
  sourceConversationId: string | null;
  sourceMessageId: string | null;
};

type ReservationDb = PrismaClient | Prisma.TransactionClient;

/** Reads and writes that cannot open their own transaction. */
export type ReservationOperations = {
  findById(id: string): Promise<ReservationRecord | null>;
  list(query: ReservationListQuery): Promise<ReservationRecord[]>;
  findLocation(id: string): Promise<LocationRecord | null>;
  findTable(id: string): Promise<TableRecord | null>;
  findAvailableTable(input: AvailabilityInput): Promise<TableRecord | null>;
  findActiveContact(id: string): Promise<{ id: string } | null>;
  findActiveUser(id: string): Promise<{ id: string } | null>;
  findHours(locationId: string, localDate: string, weekday: number): Promise<HoursWindow | null>;
  findBySourceRequest(source: SourceIdentity): Promise<StoredSourceRequest | null>;
  lockSourceRequest(source: SourceIdentity): Promise<void>;
  insertReservation(input: ReservationInsert): Promise<ReservationRecord>;
  insertSourceRequest(source: SourceIdentity, reservationId: string, requestFingerprint: string): Promise<void>;
};

export type TenantReservations = ReservationOperations & {
  transaction<T>(
    run: (reservations: ReservationOperations, tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T>;
};

class ReservationQueries implements ReservationOperations {
  constructor(
    private readonly db: ReservationDb,
    protected readonly tenantId: TenantId,
  ) {}

  async findById(id: string): Promise<ReservationRecord | null> {
    const row = await this.db.reservation.findFirst({
      where: { id, tenantId: this.tenantId },
      select: reservationSelect,
    });
    return row === null ? null : toReservation(row);
  }

  async list(query: ReservationListQuery): Promise<ReservationRecord[]> {
    const rows = await this.db.reservation.findMany({
      where: { tenantId: this.tenantId, ...reservationListFilter(query) },
      orderBy: reservationListOrder(query.sort),
      take: query.limit + 1,
      select: reservationSelect,
    });
    return rows.map(toReservation);
  }

  async findLocation(id: string): Promise<LocationRecord | null> {
    return this.db.reservationLocation.findFirst({
      where: { id, tenantId: this.tenantId },
      select: { id: true, timezone: true, status: true },
    });
  }

  async findTable(id: string): Promise<TableRecord | null> {
    return this.db.reservationTable.findFirst({
      where: { id, tenantId: this.tenantId },
      select: {
        id: true,
        locationId: true,
        minCapacity: true,
        capacity: true,
        status: true,
        archivedAt: true,
      },
    });
  }

  async findAvailableTable(input: AvailabilityInput): Promise<TableRecord | null> {
    const tables = await this.db.reservationTable.findMany({
      where: {
        tenantId: this.tenantId,
        locationId: input.locationId,
        status: 'ACTIVE',
        archivedAt: null,
        minCapacity: { lte: input.guestCount },
        capacity: { gte: input.guestCount },
      },
      orderBy: { capacity: 'asc' },
      take: 20,
      select: {
        id: true,
        locationId: true,
        minCapacity: true,
        capacity: true,
        status: true,
        archivedAt: true,
      },
    });
    for (const table of tables) {
      const overlap = await this.overlapping(table.id, input.startsAt, input.endsAt);
      if (overlap === 0) {
        return table;
      }
    }
    return null;
  }

  findActiveContact(id: string): Promise<{ id: string } | null> {
    return this.db.contact.findFirst({
      where: { id, tenantId: this.tenantId, archivedAt: null },
      select: { id: true },
    });
  }

  findActiveUser(id: string): Promise<{ id: string } | null> {
    return this.db.user.findFirst({
      where: { id, tenantId: this.tenantId, status: 'ACTIVE' },
      select: { id: true },
    });
  }

  async findHours(locationId: string, localDate: string, weekday: number): Promise<HoursWindow | null> {
    const exception = await this.db.reservationScheduleException.findFirst({
      where: { tenantId: this.tenantId, locationId, localDate: dateOnly(localDate) },
    });
    if (exception !== null) {
      return exceptionWindow(exception.isClosed, exception.opensAt, exception.closesAt);
    }
    const weekly = await this.db.reservationWorkingHours.findFirst({
      where: { tenantId: this.tenantId, locationId, weekday },
    });
    if (weekly === null) {
      return null;
    }
    return exceptionWindow(weekly.isClosed, weekly.opensAt, weekly.closesAt);
  }

  findBySourceRequest(source: SourceIdentity): Promise<StoredSourceRequest | null> {
    return findStoredSourceRequest(this.db, this.tenantId, source);
  }

  lockSourceRequest(source: SourceIdentity): Promise<void> {
    return lockStoredSourceRequest(this.db, this.tenantId, source);
  }

  async insertReservation(input: ReservationInsert): Promise<ReservationRecord> {
    const row = await this.db.reservation.create({
      data: { tenantId: this.tenantId, status: 'PENDING', ...input },
      select: reservationSelect,
    });
    return toReservation(row);
  }

  insertSourceRequest(source: SourceIdentity, reservationId: string, requestFingerprint: string): Promise<void> {
    return insertStoredSourceRequest(this.db, this.tenantId, source, reservationId, requestFingerprint);
  }

  private overlapping(tableId: string, startsAt: Date, endsAt: Date): Promise<number> {
    return this.db.reservation.count({
      where: {
        tenantId: this.tenantId,
        tableId,
        status: { in: [...BLOCKING] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
  }
}

class TenantReservationScope extends ReservationQueries implements TenantReservations {
  constructor(
    private readonly prisma: PrismaClient,
    tenantId: TenantId,
  ) {
    super(prisma, tenantId);
  }

  transaction<T>(
    run: (reservations: ReservationOperations, tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction((tx) => run(new ReservationQueries(tx, this.tenantId), tx));
  }
}

/** Opens reservation access bound to the actor's tenant. Methods do not take a tenant id. */
@Injectable()
export class ReservationRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  forTenant(actor: ReservationActor): TenantReservations {
    const tenantId = actor.type === 'USER' ? scopedTenantId(actor.context) : scopedTenantId(actor);
    return new TenantReservationScope(this.prisma, tenantId);
  }
}

function toReservation(row: ReservationRecord): ReservationRecord {
  return row;
}

function exceptionWindow(closed: boolean, opensAt: Date | null, closesAt: Date | null): HoursWindow {
  if (closed || opensAt === null || closesAt === null) {
    return { closed: true, opensMinute: 0, closesMinute: 0 };
  }
  return { closed: false, opensMinute: clockMinutes(opensAt), closesMinute: clockMinutes(closesAt) };
}

function dateOnly(localDate: string): Date {
  return new Date(`${localDate}T00:00:00.000Z`);
}
