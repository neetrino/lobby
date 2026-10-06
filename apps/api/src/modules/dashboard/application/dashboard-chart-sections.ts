import type { ContactsDashboardSlice } from '../../contacts';
import type { MembersDashboardSlice } from '../../members';
import type { ReservationsDashboardSlice } from '../../reservations';
import type { ActivityTrendDay, ReservationLoadChart, ResolvedLayout } from './dashboard-view';

type ContactDays = ContactsDashboardSlice['days'];
type InviteDays = MembersDashboardSlice['days'];

/** Daily action counts. A null series means that source is hidden, not that the count is zero. */
export function activityTrendSection(
  layout: ResolvedLayout,
  contacts: ContactsDashboardSlice | null,
  members: MembersDashboardSlice | null,
): { activityTrend?: { days: ActivityTrendDay[] } } {
  if (!layout.enabled.includes('activity') || (contacts === null && members === null)) {
    return {};
  }
  return { activityTrend: { days: mergeDays(contacts?.days ?? null, members?.days ?? null) } };
}

export function reservationLoadSection(
  layout: ResolvedLayout,
  reservations: ReservationsDashboardSlice | null,
): { reservationLoad?: ReservationLoadChart } {
  if (reservations === null || !layout.enabled.includes('reservations.summary')) {
    return {};
  }
  return { reservationLoad: reservations.load };
}

function mergeDays(contacts: ContactDays | null, members: InviteDays | null): ActivityTrendDay[] {
  const dates = contacts?.map((day) => day.date) ?? members?.map((day) => day.date) ?? [];
  const contactByDate = index(contacts);
  const inviteByDate = index(members);
  return dates.map((date) => {
    const contact = contactByDate.get(date);
    const invite = inviteByDate.get(date);
    return {
      date,
      created: contacts === null ? null : (contact?.created ?? 0),
      updated: contacts === null ? null : (contact?.updated ?? 0),
      archived: contacts === null ? null : (contact?.archived ?? 0),
      invited: members === null ? null : (invite?.invited ?? 0),
      accepted: members === null ? null : (invite?.accepted ?? 0),
    };
  });
}

function index<T extends { date: string }>(days: T[] | null): Map<string, T> {
  return new Map((days ?? []).map((day) => [day.date, day]));
}
