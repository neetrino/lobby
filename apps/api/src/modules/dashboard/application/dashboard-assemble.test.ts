import { dashboardWidgetKeys } from '@lobby/contracts';
import { describe, expect, it } from 'vitest';

import type { ContactsDashboardSlice } from '../../contacts';
import { assembleDashboard } from './dashboard-assemble';
import type { ResolvedLayout } from './dashboard-view';

const layout: ResolvedLayout = {
  rangeDays: 30,
  scope: 'all',
  enabled: [...dashboardWidgetKeys],
};

const contacts: ContactsDashboardSlice = {
  updatedAt: '2026-10-05T08:00:00.000Z',
  activeCount: 3,
  createdInRange: 2,
  createdInPrevious: 1,
  owned: [{ id: 'c1', name: 'Nareg', updatedAt: '2026-10-05T07:00:00.000Z' }],
  activity: [
    { id: 'c1', name: 'Nareg', kind: 'created', occurredAt: '2026-10-05T07:00:00.000Z' },
  ],
  days: [{ date: '2026-10-05', created: 1, updated: 0, archived: 0 }],
};

describe('dashboard assembly', () => {
  it('hides a module that is off and keeps the other widgets when one projection fails', () => {
    const data = assembleDashboard({
      generatedAt: new Date('2026-10-05T09:00:00.000Z'),
      layout,
      contacts: { status: 'fulfilled', value: contacts },
      reservations: { status: 'rejected', reason: new Error('database') },
      members: { status: 'fulfilled', value: null },
    });

    expect(data.generatedAt).toBe('2026-10-05T09:00:00.000Z');
    expect(data.reservations).toBeUndefined();
    expect(data.failures).toEqual([{ widget: 'reservations' }]);
    expect(data.overview.map((card) => card.key)).toEqual(['contacts.active', 'contacts.new']);
    expect(data.overview[0]).toMatchObject({ value: 3, trend: null });
    expect(data.overview[1]).toMatchObject({ value: 2, previous: 1, trend: 100 });
    expect(data.layout.widgets.some((widget) => widget.key.startsWith('reservations'))).toBe(false);
    expect(data.activity?.items.map((item) => item.label)).toEqual(['Nareg']);
    expect(data.reservationLoad).toBeUndefined();
    expect(data.activityTrend?.days[0]).toMatchObject({
      date: '2026-10-05',
      created: 1,
      invited: null,
      accepted: null,
    });
  });

  it('omits a widget the user turned off without filling it with zeros', () => {
    const data = assembleDashboard({
      generatedAt: new Date('2026-10-05T09:00:00.000Z'),
      layout: { ...layout, enabled: layout.enabled.filter((key) => key !== 'contacts.active') },
      contacts: { status: 'fulfilled', value: contacts },
      reservations: { status: 'fulfilled', value: null },
      members: { status: 'fulfilled', value: null },
    });

    expect(data.overview.map((card) => card.key)).toEqual(['contacts.new']);
    expect(data.layout.widgets.find((widget) => widget.key === 'contacts.active')?.enabled).toBe(
      false,
    );
  });
});
