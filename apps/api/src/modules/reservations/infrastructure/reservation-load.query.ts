import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import type { TenantId } from '../../../common/tenant/tenant-id';
import type { ReservationLoadRow } from '../domain/reservation-load';

const DAY_MS = 24 * 60 * 60 * 1000;
const CLOSED = ['CANCELLED', 'NO_SHOW'] as const;

export type ReservationLoadFacts = {
  capacity: number | null;
  rows: ReservationLoadRow[];
};

/** Guest timestamps and active seat capacity. Names, phones, and notes are not selected. */
@Injectable()
export class ReservationLoadQuery {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async read(tenantId: TenantId, todayStart: Date): Promise<ReservationLoadFacts> {
    const weekEnd = new Date(todayStart.getTime() + 7 * DAY_MS);
    const [tables, rows] = await Promise.all([
      this.prisma.restaurantTable.aggregate({
        where: { tenantId, isActive: true },
        _count: { _all: true },
        _sum: { maximumCapacity: true },
      }),
      this.prisma.reservation.findMany({
        where: {
          tenantId,
          startsAt: { gte: todayStart, lt: weekEnd },
          status: { notIn: [...CLOSED] },
        },
        select: { startsAt: true, partySize: true },
      }),
    ]);
    return {
      capacity: tables._count._all === 0 ? null : (tables._sum.maximumCapacity ?? 0),
      rows,
    };
  }
}
