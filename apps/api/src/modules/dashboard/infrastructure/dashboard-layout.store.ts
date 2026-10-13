import { Inject, Injectable } from '@nestjs/common';
import {
  dashboardRangeDaysSchema,
  dashboardScopeSchema,
  dashboardWidgetKeys,
  type DashboardRangeDays,
  type DashboardScope,
  type DashboardWidgetKey,
} from '@lobby/contracts';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { scopedTenantId } from '../../../common/auth/authorization';
import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import type { RequestContext } from '../../../common/tenant/request-context';
import type { ResolvedLayout } from '../application/dashboard-view';

export type DashboardLayoutInput = {
  rangeDays: DashboardRangeDays;
  scope: DashboardScope;
  widgets: DashboardWidgetKey[];
};

export type DashboardReadQuery = {
  rangeDays?: DashboardRangeDays;
  scope?: DashboardScope;
};

/** Stores only the caller's layout. Module facts stay in their own tables. */
@Injectable()
export class DashboardLayoutStore {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async resolve(context: RequestContext, query: DashboardReadQuery): Promise<ResolvedLayout> {
    const row = await this.prisma.userDashboardLayout.findUnique({
      where: { userId_tenantId: { userId: context.userId, tenantId: scopedTenantId(context) } },
    });
    const storedRange = dashboardRangeDaysSchema.safeParse(row?.rangeDays);
    const storedScope = dashboardScopeSchema.safeParse(row?.scope);
    return {
      rangeDays: query.rangeDays ?? (storedRange.success ? storedRange.data : 30),
      scope: query.scope ?? (storedScope.success ? storedScope.data : 'all'),
      enabled: row?.customized === true ? knownWidgets(row.widgetOrder) : [...dashboardWidgetKeys],
    };
  }

  async save(context: RequestContext, input: DashboardLayoutInput): Promise<void> {
    const tenantId = scopedTenantId(context);
    const data = {
      rangeDays: input.rangeDays,
      scope: input.scope,
      customized: true,
      widgetOrder: input.widgets,
    };
    await this.prisma.userDashboardLayout.upsert({
      where: { userId_tenantId: { userId: context.userId, tenantId } },
      create: { tenantId, userId: context.userId, ...data },
      update: data,
    });
  }
}

function knownWidgets(order: readonly string[]): DashboardWidgetKey[] {
  return order.filter((key): key is DashboardWidgetKey =>
    dashboardWidgetKeys.some((known) => known === key),
  );
}
