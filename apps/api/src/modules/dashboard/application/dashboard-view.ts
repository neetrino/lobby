import type { DashboardRangeDays, DashboardScope, DashboardWidgetKey } from '@lobby/contracts';

export type DashboardCard = {
  key: DashboardWidgetKey;
  value: number;
  previous: number | null;
  trend: number | null;
};

export type DashboardWorkItem = {
  id: string;
  label: string;
  detail: string;
  href: string | null;
};

export type DashboardWorkGroup = {
  key: 'work.contacts' | 'work.reservations';
  items: DashboardWorkItem[];
};

export type DashboardActivityItem = {
  id: string;
  kind: string;
  label: string;
  occurredAt: string;
  href: string | null;
};

export type DashboardReservationSummary = {
  updatedAt: string;
  todayCount: number;
  expectedGuests: number;
  pendingConfirmations: number;
  cancellations: number;
  occupiedTables: number;
  activeTables: number;
  upcoming: Array<{ id: string; label: string; partySize: number; startsAt: string; status: string }>;
};

export type ActivityTrendDay = {
  date: string;
  created: number | null;
  updated: number | null;
  archived: number | null;
  invited: number | null;
  accepted: number | null;
};

export type ReservationHour = { hour: number; guests: number };

export type ReservationLoadChart = {
  capacity: number | null;
  today: ReservationHour[];
  tomorrow: ReservationHour[];
  week: ReservationHour[];
};

export type DashboardAnalytics = {
  updatedAt: string;
  contactGrowth: { current: number; previous: number; trend: number | null } | null;
  occupancy: { occupied: number; active: number } | null;
};

export type DashboardLayoutWidget = { key: DashboardWidgetKey; enabled: boolean };

export type DashboardData = {
  generatedAt: string;
  rangeDays: DashboardRangeDays;
  scope: DashboardScope;
  layout: { widgets: DashboardLayoutWidget[] };
  overview: DashboardCard[];
  work: DashboardWorkGroup[];
  reservations?: DashboardReservationSummary;
  activity?: { items: DashboardActivityItem[] };
  activityTrend?: { days: ActivityTrendDay[] };
  reservationLoad?: ReservationLoadChart;
  analytics?: DashboardAnalytics;
  failures: Array<{ widget: string }>;
};

export type ResolvedLayout = {
  rangeDays: DashboardRangeDays;
  scope: DashboardScope;
  enabled: DashboardWidgetKey[];
};
