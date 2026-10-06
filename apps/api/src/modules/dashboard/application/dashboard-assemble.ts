import { dashboardWidgetKeys, type DashboardWidgetKey } from '@lobby/contracts';

import type { ContactsDashboardSlice } from '../../contacts';
import type { MembersDashboardSlice } from '../../members';
import type { ReservationsDashboardSlice } from '../../reservations';
import { trendPercent } from '../domain/dashboard-metrics';
import { activityTrendSection, reservationLoadSection } from './dashboard-chart-sections';
import type {
  DashboardActivityItem,
  DashboardAnalytics,
  DashboardCard,
  DashboardData,
  DashboardReservationSummary,
  DashboardWorkGroup,
  ResolvedLayout,
} from './dashboard-view';

type Settled<T> = PromiseSettledResult<T | null>;

const CONTACT_WIDGETS = ['contacts.active', 'contacts.new', 'work.contacts'] as const;

/**
 * Turns projection results into the dashboard document.
 * A null slice hides that module. A rejected slice records a failure and contributes no numbers.
 */
export function assembleDashboard(input: {
  generatedAt: Date;
  layout: ResolvedLayout;
  contacts: Settled<ContactsDashboardSlice>;
  reservations: Settled<ReservationsDashboardSlice>;
  members: Settled<MembersDashboardSlice>;
}): DashboardData {
  const contacts = ready(input.contacts);
  const reservations = ready(input.reservations);
  const members = ready(input.members);
  const failures = failureNames(input);
  const visible = visibleWidgets(input.layout, contacts, reservations, members);
  return {
    generatedAt: input.generatedAt.toISOString(),
    rangeDays: input.layout.rangeDays,
    scope: input.layout.scope,
    layout: { widgets: visible },
    overview: overviewCards(input.layout, contacts, reservations),
    work: workGroups(input.layout, contacts, reservations),
    ...reservationSection(input.layout, reservations),
    ...activitySection(input.layout, contacts, reservations, members),
    ...activityTrendSection(input.layout, contacts, members),
    ...reservationLoadSection(input.layout, reservations),
    ...analyticsSection(input.layout, contacts, reservations),
    failures,
  };
}

function ready<T>(result: Settled<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

function failureNames(input: {
  contacts: Settled<ContactsDashboardSlice>;
  reservations: Settled<ReservationsDashboardSlice>;
  members: Settled<MembersDashboardSlice>;
}): Array<{ widget: string }> {
  const failures: Array<{ widget: string }> = [];
  if (input.contacts.status === 'rejected') {
    failures.push({ widget: 'contacts' });
  }
  if (input.reservations.status === 'rejected') {
    failures.push({ widget: 'reservations' });
  }
  if (input.members.status === 'rejected') {
    failures.push({ widget: 'members' });
  }
  return failures;
}

function visibleWidgets(
  layout: ResolvedLayout,
  contacts: ContactsDashboardSlice | null,
  reservations: ReservationsDashboardSlice | null,
  members: MembersDashboardSlice | null,
): Array<{ key: DashboardWidgetKey; enabled: boolean }> {
  const available = dashboardWidgetKeys.filter((key) =>
    sourceAvailable(key, contacts, reservations, members),
  );
  const enabled = layout.enabled.filter((key) => available.includes(key));
  const disabled = available.filter((key) => !enabled.includes(key));
  return [...enabled, ...disabled].map((key) => ({ key, enabled: enabled.includes(key) }));
}

function sourceAvailable(
  key: DashboardWidgetKey,
  contacts: ContactsDashboardSlice | null,
  reservations: ReservationsDashboardSlice | null,
  members: MembersDashboardSlice | null,
): boolean {
  if (key === 'activity') {
    return contacts !== null || reservations !== null || members !== null;
  }
  if (key === 'analytics') {
    return contacts !== null || reservations !== null;
  }
  if (isContactWidget(key)) {
    return contacts !== null;
  }
  return reservations !== null;
}

function isContactWidget(key: DashboardWidgetKey): boolean {
  return CONTACT_WIDGETS.some((item) => item === key);
}

function overviewCards(
  layout: ResolvedLayout,
  contacts: ContactsDashboardSlice | null,
  reservations: ReservationsDashboardSlice | null,
): DashboardCard[] {
  const cards: DashboardCard[] = [];
  if (contacts !== null && on(layout, 'contacts.active')) {
    cards.push({ key: 'contacts.active', value: contacts.activeCount, previous: null, trend: null });
  }
  if (contacts !== null && on(layout, 'contacts.new')) {
    cards.push(compared('contacts.new', contacts.createdInRange, contacts.createdInPrevious));
  }
  if (reservations !== null && on(layout, 'reservations.today')) {
    cards.push(compared('reservations.today', reservations.todayCount, reservations.yesterdayCount));
  }
  if (reservations !== null && on(layout, 'reservations.attention')) {
    cards.push({
      key: 'reservations.attention',
      value: reservations.attentionCount,
      previous: null,
      trend: null,
    });
  }
  return cards;
}

function compared(key: DashboardCard['key'], current: number, previous: number): DashboardCard {
  return { key, value: current, previous, trend: trendPercent(current, previous) };
}

function workGroups(
  layout: ResolvedLayout,
  contacts: ContactsDashboardSlice | null,
  reservations: ReservationsDashboardSlice | null,
): DashboardWorkGroup[] {
  const groups: DashboardWorkGroup[] = [];
  if (contacts !== null && on(layout, 'work.contacts')) {
    groups.push({
      key: 'work.contacts',
      items: contacts.owned.map((item) => ({
        id: item.id,
        label: item.name,
        detail: item.updatedAt,
        href: '/contacts',
      })),
    });
  }
  if (reservations !== null && on(layout, 'work.reservations')) {
    groups.push({
      key: 'work.reservations',
      items: reservations.mine.map((item) => ({
        id: item.id,
        label: item.customerName,
        detail: item.startsAt,
        href: null,
      })),
    });
  }
  return groups;
}

function reservationSection(
  layout: ResolvedLayout,
  reservations: ReservationsDashboardSlice | null,
): { reservations?: DashboardReservationSummary } {
  if (reservations === null || !on(layout, 'reservations.summary')) {
    return {};
  }
  return {
    reservations: {
      updatedAt: reservations.updatedAt,
      todayCount: reservations.todayCount,
      expectedGuests: reservations.expectedGuests,
      pendingConfirmations: reservations.pendingConfirmations,
      cancellations: reservations.cancellations,
      occupiedTables: reservations.occupiedTables,
      activeTables: reservations.activeTables,
      upcoming: reservations.upcoming.map((item) => ({
        id: item.id,
        label: item.customerName,
        partySize: item.partySize,
        startsAt: item.startsAt,
        status: item.status,
      })),
    },
  };
}

function activitySection(
  layout: ResolvedLayout,
  contacts: ContactsDashboardSlice | null,
  reservations: ReservationsDashboardSlice | null,
  members: MembersDashboardSlice | null,
): { activity?: { items: DashboardActivityItem[] } } {
  if (!on(layout, 'activity') || (contacts === null && reservations === null && members === null)) {
    return {};
  }
  const items = [
    ...(contacts?.activity.map(contactActivity) ?? []),
    ...(reservations?.activity.map(reservationActivity) ?? []),
    ...(members?.accepted.map(invitationActivity) ?? []),
  ];
  items.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  return { activity: { items: items.slice(0, 8) } };
}

function contactActivity(item: ContactsDashboardSlice['activity'][number]): DashboardActivityItem {
  return {
    id: `contact:${item.id}`,
    kind: `contact.${item.kind}`,
    label: item.name,
    occurredAt: item.occurredAt,
    href: '/contacts',
  };
}

function reservationActivity(
  item: ReservationsDashboardSlice['activity'][number],
): DashboardActivityItem {
  return {
    id: `reservation:${item.id}`,
    kind: `reservation.${item.kind}`,
    label: item.customerName,
    occurredAt: item.occurredAt,
    href: null,
  };
}

function invitationActivity(item: MembersDashboardSlice['accepted'][number]): DashboardActivityItem {
  return {
    id: `invitation:${item.id}`,
    kind: 'invitation.accepted',
    label: item.email,
    occurredAt: item.occurredAt,
    href: null,
  };
}

function analyticsSection(
  layout: ResolvedLayout,
  contacts: ContactsDashboardSlice | null,
  reservations: ReservationsDashboardSlice | null,
): { analytics?: DashboardAnalytics } {
  if (!on(layout, 'analytics') || (contacts === null && reservations === null)) {
    return {};
  }
  return {
    analytics: {
      updatedAt: contacts?.updatedAt ?? reservations?.updatedAt ?? new Date().toISOString(),
      contactGrowth:
        contacts === null
          ? null
          : {
              current: contacts.createdInRange,
              previous: contacts.createdInPrevious,
              trend: trendPercent(contacts.createdInRange, contacts.createdInPrevious),
            },
      occupancy:
        reservations === null
          ? null
          : { occupied: reservations.occupiedTables, active: reservations.activeTables },
    },
  };
}

function on(layout: ResolvedLayout, key: DashboardWidgetKey): boolean {
  return layout.enabled.includes(key);
}
