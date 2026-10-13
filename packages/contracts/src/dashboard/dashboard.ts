import { z } from 'zod';

/** Widgets the general dashboard knows how to place. A module adds a key only with a real projection. */
export const dashboardWidgetKeys = [
  'contacts.active',
  'contacts.new',
  'reservations.today',
  'reservations.attention',
  'work.contacts',
  'work.reservations',
  'reservations.summary',
  'activity',
  'analytics',
] as const;

export const dashboardWidgetKeySchema = z.enum(dashboardWidgetKeys);

export type DashboardWidgetKey = z.infer<typeof dashboardWidgetKeySchema>;

export const dashboardRangeDays = [7, 30, 90] as const;

export const dashboardRangeDaysSchema = z.union([
  z.literal(dashboardRangeDays[0]),
  z.literal(dashboardRangeDays[1]),
  z.literal(dashboardRangeDays[2]),
]);

export type DashboardRangeDays = z.infer<typeof dashboardRangeDaysSchema>;

export const dashboardScopes = ['all', 'mine'] as const;

export const dashboardScopeSchema = z.enum(dashboardScopes);

export type DashboardScope = z.infer<typeof dashboardScopeSchema>;
