import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import type { TenantId } from '../../../common/tenant/tenant-id';

const OPEN = ['HOLD', 'PENDING', 'CONFIRMED'] as const;
const ATTENTION = ['HOLD', 'PENDING'] as const;
const CLOSED = ['CANCELLED', 'NO_SHOW'] as const;

export type ReservationLabel = {
  id: string;
  customerName: string;
  partySize: number;
  startsAt: Date;
  status: string;
};

export type ReservationActivityRow = {
  id: string;
  customerName: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ReservationDashboardFacts = {
  todayCount: number;
  yesterdayCount: number;
  expectedGuests: number;
  pendingConfirmations: number;
  attentionCount: number;
  cancellations: number;
  occupiedTables: number;
  activeTables: number;
  upcoming: ReservationLabel[];
  mine: ReservationLabel[];
  activity: ReservationActivityRow[];
};

type Window = {
  from: Date;
  to: Date;
  todayStart: Date;
  todayEnd: Date;
  yesterdayStart: Date;
  now: Date;
};

/** Tenant-scoped reservation counts. Phone, email, and notes are not selected. */
@Injectable()
export class ReservationsDashboardQuery {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async read(tenantId: TenantId, userId: string, window: Window): Promise<ReservationDashboardFacts> {
    const [today, yesterdayCount, pendingConfirmations, attentionCount, cancellations, occupied, activeTables, upcoming, mine, activity] =
      await Promise.all([
        this.today(tenantId, window),
        this.dayCount(tenantId, window.yesterdayStart, window.todayStart),
        this.prisma.reservation.count({ where: { tenantId, status: 'PENDING' } }),
        this.attention(tenantId, window.now),
        this.prisma.reservation.count({
          where: { tenantId, status: { in: [...CLOSED] }, updatedAt: { gte: window.from, lt: window.to } },
        }),
        this.occupiedTables(tenantId, window.now),
        this.prisma.restaurantTable.count({ where: { tenantId, isActive: true } }),
        this.upcoming(tenantId, window.now),
        this.mine(tenantId, userId, window.now),
        this.activity(tenantId, window),
      ]);
    return {
      todayCount: today.count,
      yesterdayCount,
      expectedGuests: today.guests,
      pendingConfirmations,
      attentionCount,
      cancellations,
      occupiedTables: occupied,
      activeTables,
      upcoming,
      mine,
      activity,
    };
  }

  private async today(tenantId: TenantId, window: Window): Promise<{ count: number; guests: number }> {
    const row = await this.prisma.reservation.aggregate({
      where: {
        tenantId,
        startsAt: { gte: window.todayStart, lt: window.todayEnd },
        status: { notIn: [...CLOSED] },
      },
      _count: { _all: true },
      _sum: { partySize: true },
    });
    return { count: row._count._all, guests: row._sum.partySize ?? 0 };
  }

  private dayCount(tenantId: TenantId, from: Date, to: Date): Promise<number> {
    return this.prisma.reservation.count({
      where: { tenantId, startsAt: { gte: from, lt: to }, status: { notIn: [...CLOSED] } },
    });
  }

  private attention(tenantId: TenantId, now: Date): Promise<number> {
    const soon = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const overdueFrom = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    return this.prisma.reservation.count({
      where: { tenantId, status: { in: [...ATTENTION] }, startsAt: { gte: overdueFrom, lte: soon } },
    });
  }

  private async occupiedTables(tenantId: TenantId, now: Date): Promise<number> {
    const rows = await this.prisma.reservationTable.findMany({
      where: { tenantId, blocksAvailability: true, startsAt: { lte: now }, endsAt: { gt: now } },
      select: { tableId: true },
      distinct: ['tableId'],
    });
    return rows.length;
  }

  private upcoming(tenantId: TenantId, now: Date): Promise<ReservationLabel[]> {
    return this.labeled({ tenantId, startsAt: { gte: now }, status: { in: [...OPEN] } });
  }

  private mine(tenantId: TenantId, userId: string, now: Date): Promise<ReservationLabel[]> {
    return this.labeled({
      tenantId,
      createdByUserId: userId,
      startsAt: { gte: now },
      status: { in: [...OPEN] },
    });
  }

  private labeled(where: {
    tenantId: TenantId;
    createdByUserId?: string;
    startsAt: { gte: Date };
    status: { in: Array<(typeof OPEN)[number]> };
  }): Promise<ReservationLabel[]> {
    return this.prisma.reservation.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      take: 5,
      select: { id: true, customerName: true, partySize: true, startsAt: true, status: true },
    });
  }

  private activity(tenantId: TenantId, window: Window): Promise<ReservationActivityRow[]> {
    return this.prisma.reservation.findMany({
      where: { tenantId, updatedAt: { gte: window.from, lt: window.to } },
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: { id: true, customerName: true, status: true, createdAt: true, updatedAt: true },
    });
  }
}
