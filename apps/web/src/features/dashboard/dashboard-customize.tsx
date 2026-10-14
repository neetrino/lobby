'use client';

import { dashboardWidgetKeys } from '@lobby/contracts';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type AnimationEvent as ReactAnimationEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

import type { DashboardBoard } from './dashboard-api';
import { widgetLabel } from './dashboard-layout';
import drawer from './dashboard-drawer.module.css';
import styles from './dashboard-toolbar.module.css';

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
  const titleId = useId();
  const dragIndex = useRef<number | null>(null);
  const closed = useRef(false);
  const [rows, setRows] = useState(widgets);
  const [leaving, setLeaving] = useState(false);

  const close = useCallback(() => {
    if (closed.current) {
      return;
    }
    if (prefersReducedMotion()) {
      closed.current = true;
      onClose();
      return;
    }
    setLeaving(true);
  }, [onClose]);

  function finishClose(event: ReactAnimationEvent<HTMLDivElement>): void {
    if (event.target !== event.currentTarget || !leaving || closed.current) {
      return;
    }
    closed.current = true;
    onClose();
  }

  useEffect(() => {
    if (!leaving) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      if (closed.current) {
        return;
      }
      closed.current = true;
      onClose();
    }, 320);
    return () => window.clearTimeout(timer);
  }, [leaving, onClose]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        close();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close]);

  return createPortal(
    <div
      className={leaving ? `${drawer.backdrop} ${drawer.backdropLeaving}` : drawer.backdrop}
      onClick={close}
    >
      <DrawerForm
        titleId={titleId}
        title={t('customizeTitle')}
        rows={rows}
        pending={pending}
        leaving={leaving}
        onMotionEnd={finishClose}
        onClose={close}
        onToggle={(key) => setRows((current) => toggle(current, key))}
        onDragStart={(index) => {
          dragIndex.current = index;
        }}
        onDrop={(index) => {
          const from = dragIndex.current;
          dragIndex.current = null;
          setRows((current) => move(current, from, index));
        }}
        onKeyMove={(index, direction) =>
          setRows((current) => move(current, index, index + direction))
        }
        onReset={() => setRows(resetRows(widgets))}
        onSave={() => {
          const enabled = rows.filter((widget) => widget.enabled).map((widget) => widget.key);
          void onSave(enabled).then((saved) => {
            if (saved) {
              close();
            }
          });
        }}
      />
    </div>,
    document.body,
  );
}

type DrawerFormProps = {
  titleId: string;
  title: string;
  rows: WidgetRow[];
  pending: boolean;
  leaving: boolean;
  onMotionEnd: (event: ReactAnimationEvent<HTMLDivElement>) => void;
  onClose: () => void;
  onToggle: (key: string) => void;
  onDragStart: (index: number) => void;
  onDrop: (index: number) => void;
  onKeyMove: (index: number, direction: -1 | 1) => void;
  onReset: () => void;
  onSave: () => void;
};

function DrawerForm({
  titleId,
  title,
  rows,
  pending,
  leaving,
  onMotionEnd,
  onClose,
  onToggle,
  onDragStart,
  onDrop,
  onKeyMove,
  onReset,
  onSave,
}: DrawerFormProps) {
  const t = useTranslations('dashboard');
  const sheetClass = leaving ? `${drawer.sheet} ${drawer.sheetLeaving}` : drawer.sheet;
  return (
    <div
      className={sheetClass}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onAnimationEnd={onMotionEnd}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className={drawer.cornerClose}
        onClick={onClose}
        aria-label={t('close')}
      >
        <X aria-hidden="true" />
      </button>
      <form
        className={drawer.drawer}
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <header className={drawer.drawerHead}>
          <h2 id={titleId}>{title}</h2>
        </header>
        <div className={drawer.widgetList}>
          {rows.map((widget, index) => (
            <WidgetRowEditor
              key={widget.key}
              widget={widget}
              onToggle={() => onToggle(widget.key)}
              onDragStart={() => onDragStart(index)}
              onDrop={() => onDrop(index)}
              onKeyMove={(direction) => onKeyMove(index, direction)}
            />
          ))}
        </div>
        <DrawerActions pending={pending} onReset={onReset} />
      </form>
    </div>
  );
}

function DrawerActions({ pending, onReset }: { pending: boolean; onReset: () => void }) {
  const t = useTranslations('dashboard');
  return (
    <div className={drawer.drawerActions}>
      <button type="button" className={drawer.reset} onClick={onReset}>
        {t('reset')}
      </button>
      <button type="submit" className={styles.save} disabled={pending}>
        {t('saveChanges')}
      </button>
    </div>
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
        <input type="checkbox" checked={widget.enabled} onChange={onToggle} />
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

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
