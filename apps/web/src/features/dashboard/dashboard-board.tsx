'use client';

import type { DashboardRangeDays, DashboardScope } from '@lobby/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import type { SessionPrincipal } from '../contacts/contact';
import type { DashboardBoard } from './dashboard-api';
import { CustomizeDrawer } from './dashboard-customize';
import { KpiCard, kpiSpan } from './dashboard-kpi';
import { ActivityTrend } from './dashboard-activity-chart';
import { ReservationCharts } from './dashboard-reservation-charts';
import { ReservationRow, Snapshot, WorkPanel } from './dashboard-panels';
import { DashboardToolbar } from './dashboard-toolbar';
import styles from './dashboard.module.css';

export function DashboardBoardView({
  board,
  range,
  scope,
  pending,
  notice,
  session,
  onRange,
  onScope,
  onSaveLayout,
}: {
  board: DashboardBoard;
  range: DashboardRangeDays;
  scope: DashboardScope;
  pending: boolean;
  notice: string | null;
  session: SessionPrincipal | null;
  onRange: (range: DashboardRangeDays) => void;
  onScope: (scope: DashboardScope) => void;
  onSaveLayout: (widgets: string[]) => Promise<boolean>;
}) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const [customizing, setCustomizing] = useState(false);
  const span = kpiSpan(board.overview.length);

  return (
    <div className={styles.page}>
      <DashboardToolbar
        range={range}
        scope={scope}
        generatedAt={board.generatedAt}
        locale={locale}
        session={session}
        onRange={onRange}
        onScope={onScope}
        onCustomize={() => setCustomizing(true)}
      />
      {board.failures.length === 0 ? null : <p className={styles.banner}>{t('failed')}</p>}
      {notice === null ? null : <p className={styles.notice}>{notice}</p>}
      <div className={styles.grid}>
        {board.overview.map((card) => (
          <KpiCard key={card.key} card={card} locale={locale} span={span} />
        ))}
        <ReservationRow board={board} />
        <ActivityTrend board={board} locale={locale} />
        <ReservationCharts board={board} />
        <WorkPanel board={board} locale={locale} wide={board.analytics === undefined} />
        {board.analytics === undefined ? null : <Snapshot board={board} />}
      </div>
      {customizing ? (
        <CustomizeDrawer
          widgets={board.layout.widgets}
          pending={pending}
          onClose={() => setCustomizing(false)}
          onSave={(widgets) => {
            void onSaveLayout(widgets).then((saved) => {
              if (saved) {
                setCustomizing(false);
              }
            });
          }}
        />
      ) : null}
    </div>
  );
}
