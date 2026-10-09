import { Injectable } from '@nestjs/common';

import { scopedTenantId } from '../../../common/auth/authorization';
import { ModuleEntitlementService } from '../../../common/authorization/module-entitlement';
import { hasPermission } from '../../../common/authorization/require-permission';
import type { RequestContext } from '../../../common/tenant/request-context';
import { reservationLoad, type ReservationLoad } from '../domain/reservation-load';
import { ReservationLoadQuery } from '../infrastructure/reservation-load.query';
import {
  ReservationsDashboardQuery,
  type ReservationActivityRow,
  type ReservationLabel,
} from '../infrastructure/reservations-dashboard.query';

export type ReservationCard = {
  id: string;
  customerName: string;
  partySize: number;
  startsAt: string;
  status: string;
};

export type ReservationsDashboardSlice = {
  updatedAt: string;
  todayCount: number;
  yesterdayCount: number;
  expectedGuests: number;
  pendingConfirmations: number;
  attentionCount: number;
  cancellations: number;
  occupiedTables: number;
  activeTables: number;
  upcoming: ReservationCard[];
  mine: ReservationCard[];
  activity: Array<{ id: string; customerName: string; kind: ReservationActivityKind; occurredAt: string }>;
  load: ReservationLoad;
};

export type ReservationActivityKind = 'created' | 'cancelled' | 'no_show';

type Window = {
  from: Date;
  to: Date;
  todayStart: Date;
  todayEnd: Date;
  yesterdayStart: Date;
  now: Date;
};

/**
 * Read-only reservation facts for the dashboard.
 * Returns null when the reservations module is off or `reservations:read` is missing.
 */
@Injectable()
export class ReservationsDashboardProjection {
  constructor(
    private readonly entitlements: ModuleEntitlementService,
    private readonly facts: ReservationsDashboardQuery,
    private readonly load: ReservationLoadQuery,
  ) {}

  async project(context: RequestContext, window: Window): Promise<ReservationsDashboardSlice | null> {
    if (!(await this.allowed(context))) {
      return null;
    }
    const tenantId = scopedTenantId(context);
    const [facts, load] = await Promise.all([
      this.facts.read(tenantId, context.userId, window),
      this.load.read(tenantId, window.todayStart),
    ]);
    return {
      updatedAt: new Date().toISOString(),
      todayCount: facts.todayCount,
      yesterdayCount: facts.yesterdayCount,
      expectedGuests: facts.expectedGuests,
      pendingConfirmations: facts.pendingConfirmations,
      attentionCount: facts.attentionCount,
      cancellations: facts.cancellations,
      occupiedTables: facts.occupiedTables,
      activeTables: facts.activeTables,
      upcoming: facts.upcoming.map(card),
      mine: facts.mine.map(card),
      activity: facts.activity.flatMap(activity),
      load: reservationLoad(window.todayStart, load.rows, load.capacity),
    };
  }

  /** Entitlement first, then permission. Either miss hides the whole reservations section. */
  private async allowed(context: RequestContext): Promise<boolean> {
    const enabled = await this.entitlements.isEnabled(scopedTenantId(context), 'reservations');
    return enabled && hasPermission(context.role, 'reservations:read');
  }
}

function card(row: ReservationLabel): ReservationCard {
  return {
    id: row.id,
    customerName: row.customerName,
    partySize: row.partySize,
    startsAt: row.startsAt.toISOString(),
    status: row.status,
  };
}

function activity(row: ReservationActivityRow): ReservationsDashboardSlice['activity'] {
  const kind = reservationKind(row.status, row.createdAt, row.updatedAt);
  if (kind === null) {
    return [];
  }
  return [{ id: row.id, customerName: row.customerName, kind, occurredAt: row.updatedAt.toISOString() }];
}

function reservationKind(
  status: string,
  createdAt: Date,
  updatedAt: Date,
): ReservationActivityKind | null {
  if (status === 'CANCELLED') {
    return 'cancelled';
  }
  if (status === 'NO_SHOW') {
    return 'no_show';
  }
  return updatedAt.getTime() - createdAt.getTime() < 1000 ? 'created' : null;
}
