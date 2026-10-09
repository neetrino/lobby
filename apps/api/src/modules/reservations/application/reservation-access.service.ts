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
  type ReservationRecord,
} from '../infrastructure/reservation.repository';
import { ReservationFailure } from './reservation-errors';
import { toReservationPage } from './list-reservations.query';
import type { ReservationListQuery } from './list-reservations.schema';

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
