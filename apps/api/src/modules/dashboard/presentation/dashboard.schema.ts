import {
  dashboardRangeDaysSchema,
  dashboardScopeSchema,
  dashboardWidgetKeySchema,
  dashboardWidgetKeys,
} from '@lobby/contracts';
import { z } from 'zod';

export const dashboardQuerySchema = z.strictObject({
  range: z.enum(['7', '30', '90']).optional(),
  scope: dashboardScopeSchema.optional(),
});

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;

export const dashboardLayoutSchema = z
  .strictObject({
    rangeDays: dashboardRangeDaysSchema,
    scope: dashboardScopeSchema,
    widgets: z.array(dashboardWidgetKeySchema).max(dashboardWidgetKeys.length),
  })
  .refine((body) => new Set(body.widgets).size === body.widgets.length, { path: ['widgets'] });

export type DashboardLayoutBody = z.infer<typeof dashboardLayoutSchema>;
