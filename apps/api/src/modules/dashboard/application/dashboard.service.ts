import { Injectable } from '@nestjs/common';

import { requirePermission } from '../../../common/authorization/require-permission';
import type { RequestContext } from '../../../common/tenant/request-context';
import { ContactsDashboardProjection } from '../../contacts';
import { MembersDashboardProjection } from '../../members';
import { ReservationsDashboardProjection } from '../../reservations';
import { dateWindow } from '../domain/date-window';
import {
  DashboardLayoutStore,
  type DashboardLayoutInput,
  type DashboardReadQuery,
} from '../infrastructure/dashboard-layout.store';
import { assembleDashboard } from './dashboard-assemble';
import type { DashboardData } from './dashboard-view';

/**
 * Read-only aggregation. It calls each module's public projection and never writes their tables.
 * One projection failure is recorded and the other widgets are still returned.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly layouts: DashboardLayoutStore,
    private readonly contacts: ContactsDashboardProjection,
    private readonly reservations: ReservationsDashboardProjection,
    private readonly members: MembersDashboardProjection,
  ) {}

  async read(context: RequestContext, query: DashboardReadQuery): Promise<DashboardData> {
    requirePermission(context, 'dashboard:read');
    const layout = await this.layouts.resolve(context, query);
    return this.collect(context, layout);
  }

  async save(context: RequestContext, input: DashboardLayoutInput): Promise<DashboardData> {
    requirePermission(context, 'dashboard:read');
    await this.layouts.save(context, input);
    const layout = await this.layouts.resolve(context, {});
    return this.collect(context, layout);
  }

  private async collect(
    context: RequestContext,
    layout: Awaited<ReturnType<DashboardLayoutStore['resolve']>>,
  ): Promise<DashboardData> {
    const window = dateWindow(layout.rangeDays, new Date());
    const [contacts, reservations, members] = await Promise.allSettled([
      this.contacts.project(context, layout.scope, window),
      this.reservations.project(context, window),
      this.members.project(context, window),
    ]);
    return assembleDashboard({ generatedAt: new Date(), layout, contacts, reservations, members });
  }
}
