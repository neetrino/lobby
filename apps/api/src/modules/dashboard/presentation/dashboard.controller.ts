import { Controller, Get, HttpCode, Put } from '@nestjs/common';
import type { DashboardRangeDays } from '@lobby/contracts';

import { CurrentRequest } from '../../../common/auth/current-request';
import { Authorize } from '../../../common/authorization/permission.guard';
import { ZodBody, ZodQuery } from '../../../common/pipes/zod-input';
import type { RequestContext } from '../../../common/tenant/request-context';
import { DashboardService } from '../application/dashboard.service';
import type { DashboardData } from '../application/dashboard-view';
import {
  dashboardLayoutSchema,
  dashboardQuerySchema,
  type DashboardLayoutBody,
  type DashboardQueryInput,
} from './dashboard.schema';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @Authorize('dashboard:read')
  async read(
    @CurrentRequest() context: RequestContext,
    @ZodQuery(dashboardQuerySchema) query: DashboardQueryInput,
  ): Promise<{ data: DashboardData }> {
    return {
      data: await this.dashboard.read(context, {
        rangeDays: query.range === undefined ? undefined : rangeDays(query.range),
        scope: query.scope,
      }),
    };
  }

  @Put('layout')
  @Authorize('dashboard:read')
  @HttpCode(200)
  async save(
    @CurrentRequest() context: RequestContext,
    @ZodBody(dashboardLayoutSchema) body: DashboardLayoutBody,
  ): Promise<{ data: DashboardData }> {
    return { data: await this.dashboard.save(context, body) };
  }
}

function rangeDays(value: '7' | '30' | '90'): DashboardRangeDays {
  if (value === '7') {
    return 7;
  }
  return value === '30' ? 30 : 90;
}
