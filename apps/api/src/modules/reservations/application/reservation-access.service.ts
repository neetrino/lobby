import { Injectable } from '@nestjs/common';
import type { CursorPage } from '@lobby/contracts';

import { scopedTenantId } from '../../../common/auth/authorization';
import {
  ModuleDisabledError,
  ModuleEntitlementService,
} from '../../../common/authorization/module-entitlement';
import { requirePermission } from '../../../common/authorization/require-permission';
import type { RequestContext } from '../../../common/tenant/request-context';
import {
  ReservationRepository,
  type LocationListRecord,
  type ReservationRecord,
  type ReservationHistoryRecord,
  type TableRecord,
} from '../infrastructure/reservation.repository';
import { ReservationFailure } from './reservation-errors';
import { toReservationPage } from './list-reservations.query';
import type { ReservationListQuery } from './list-reservations.schema';
import type { AvailabilityQuery } from './reservation-read.schema';
import { assertReservationWindow } from './reservation-rules';

@Injectable()
export class ReservationAccessService {
  constructor(
    private readonly reservations: ReservationRepository,
    private readonly entitlements: ModuleEntitlementService,
  ) {}

  async read(context: RequestContext, id: string): Promise<ReservationRecord | null> {
    await this.authorize(context);
    return this.reservations.forTenant({ type: 'USER', context }).findById(id);
  }

  async list(
    context: RequestContext,
    query: ReservationListQuery,
  ): Promise<CursorPage<ReservationRecord>> {
    await this.authorize(context);
    const rows = await this.reservations.forTenant({ type: 'USER', context }).list(query);
    return toReservationPage(rows, query);
  }

  async locations(context: RequestContext): Promise<LocationListRecord[]> {
    await this.authorize(context);
    return this.scope(context).listLocations();
  }

  async tables(context: RequestContext, locationId: string): Promise<TableRecord[]> {
    await this.authorize(context);
    const scope = this.scope(context);
    const location = await scope.findLocation(locationId);
    if (location === null || location.status !== 'ACTIVE') {
      throw new ReservationFailure('RESERVATION_LOCATION_NOT_FOUND');
    }
    return scope.listTables(locationId);
  }

  async availability(context: RequestContext, query: AvailabilityQuery): Promise<TableRecord[]> {
    await this.authorize(context);
    const scope = this.scope(context);
    const startsAt = new Date(query.startsAt);
    const endsAt = new Date(startsAt.getTime() + query.durationMinutes * 60_000);
    await assertReservationWindow(scope, query.locationId, { startsAt, endsAt }, new Date());
    if (
      query.excludeReservationId !== undefined &&
      (await scope.findById(query.excludeReservationId)) === null
    ) {
      throw new ReservationFailure('RESERVATION_NOT_FOUND');
    }
    return scope.listAvailableTables(query, startsAt, endsAt);
  }

  async history(context: RequestContext, id: string): Promise<ReservationHistoryRecord[]> {
    await this.authorize(context);
    const scope = this.scope(context);
    if ((await scope.findById(id)) === null) {
      throw new ReservationFailure('RESERVATION_NOT_FOUND');
    }
    return scope.history(id);
  }

  private scope(context: RequestContext) {
    return this.reservations.forTenant({ type: 'USER', context });
  }

  private async authorize(context: RequestContext): Promise<void> {
    try {
      await this.entitlements.requireEnabled(scopedTenantId(context), 'reservations');
    } catch (error) {
      if (error instanceof ModuleDisabledError) {
        throw new ReservationFailure('RESERVATION_MODULE_DISABLED');
      }
      throw error;
    }
    requirePermission(context, 'reservations:read');
  }
}
