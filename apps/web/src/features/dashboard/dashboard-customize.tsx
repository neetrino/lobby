'use client';

import { dashboardWidgetKeys } from '@lobby/contracts';
import { Checkbox } from '../../ui/checkbox/checkbox';
import { useTranslations } from 'next-intl';
import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';

import type { DashboardBoard } from './dashboard-api';
import { widgetLabel } from './dashboard-layout';
import { OverlayPortal } from '../contacts/overlay-portal';
import { SheetChrome, SheetFrame, sheetStyles } from '../../ui/side-sheet/side-sheet';
import drawer from './dashboard-drawer.module.css';

type WidgetRow = DashboardBoard['layout']['widgets'][number];

export function CustomizeDrawer({
  widgets,
  pending,
  onClose,
  onSave,
}: {
  widgets: WidgetRow[];
  pending: boolean;
  onClose: () => void;
  onSave: (widgets: string[]) => Promise<boolean>;
}) {
  const t = useTranslations('dashboard');
  const dragIndex = useRef<number | null>(null);
  const [rows, setRows] = useState(widgets);

  return (
    <OverlayPortal onDismiss={onClose}>
      <SheetFrame label={t('customizeTitle')} closeLabel={t('close')}>
        <SheetChrome
          as="form"
          title={t('customizeTitle')}
          onSubmit={(event) => {
            event.preventDefault();
            const enabled = rows.filter((widget) => widget.enabled).map((widget) => widget.key);
            void onSave(enabled).then((saved) => {
              if (saved) onClose();
            });
          }}
          footer={
            <>
              <button
                type="button"
                className={drawer.reset}
                onClick={() => setRows(resetRows(widgets))}
              >
                {t('reset')}
              </button>
              <button type="submit" className={sheetStyles.save} disabled={pending}>
                {t('saveChanges')}
              </button>
            </>
          }
        >
          {rows.map((widget, index) => (
            <WidgetRowEditor
              key={widget.key}
              widget={widget}
              onToggle={() => setRows((current) => toggle(current, widget.key))}
              onDragStart={() => {
                dragIndex.current = index;
              }}
              onDrop={() => {
                const from = dragIndex.current;
                dragIndex.current = null;
                setRows((current) => move(current, from, index));
              }}
              onKeyMove={(direction) =>
                setRows((current) => move(current, index, index + direction))
              }
            />
          ))}
        </SheetChrome>
      </SheetFrame>
    </OverlayPortal>
  );
}

function WidgetRowEditor({
  widget,
  onToggle,
  onDragStart,
  onDrop,
  onKeyMove,
}: {
  widget: WidgetRow;
  onToggle: () => void;
  onDragStart: () => void;
  onDrop: () => void;
  onKeyMove: (direction: -1 | 1) => void;
}) {
  const t = useTranslations('dashboard');
  return (
    <div
      className={drawer.widgetRow}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <button
        type="button"
        className={drawer.handle}
        draggable
        aria-label={t('reorder')}
        onDragStart={onDragStart}
        onKeyDown={(event) => onReorderKey(event, onKeyMove)}
      >
        <DragIcon />
      </button>
      <label>
        <Checkbox checked={widget.enabled} onChange={onToggle} />
        {widgetLabel(t, widget.key)}
      </label>
    </div>
  );
}

function onReorderKey(
  event: ReactKeyboardEvent<HTMLButtonElement>,
  onKeyMove: (direction: -1 | 1) => void,
): void {
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    onKeyMove(-1);
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    onKeyMove(1);
  }
}

function DragIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="5" cy="3.5" r="1" />
      <circle cx="11" cy="3.5" r="1" />
      <circle cx="5" cy="8" r="1" />
      <circle cx="11" cy="8" r="1" />
      <circle cx="5" cy="12.5" r="1" />
      <circle cx="11" cy="12.5" r="1" />
    </svg>
  );
}

function toggle(widgets: WidgetRow[], key: string): WidgetRow[] {
  return widgets.map((item) => (item.key === key ? { ...item, enabled: !item.enabled } : item));
}

function move(widgets: WidgetRow[], from: number | null, to: number): WidgetRow[] {
  if (from === null || to < 0 || to >= widgets.length || from === to) {
    return widgets;
  }
  const copy = [...widgets];
  const [item] = copy.splice(from, 1);
  if (item === undefined) {
    return widgets;
  }
  copy.splice(to, 0, item);
  return copy;
}

function resetRows(widgets: WidgetRow[]): WidgetRow[] {
  const rank = new Map<string, number>(dashboardWidgetKeys.map((key, index) => [key, index]));
  return [...widgets]
    .map((widget) => ({ ...widget, enabled: true }))
    .sort((left, right) => rankOf(rank, left.key) - rankOf(rank, right.key));
}

function rankOf(rank: Map<string, number>, key: string): number {
  return rank.get(key) ?? dashboardWidgetKeys.length;
}
