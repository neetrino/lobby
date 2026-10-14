'use client';

import { useState, type CSSProperties, type ReactElement, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';

import { anchoredStyle, useAnchoredBox, useMenuDismiss } from '../select/anchored-menu';
import type { AnchoredBox } from '../select/anchored-menu';
import {
  buildMonth,
  dateTimeValue,
  dateValue,
  monthTitle,
  parseDateTime,
  shiftMonth,
  todayParts,
  readUnit,
  weekdayLabels,
  weekStartsOn,
  withTime,
  type CalendarMode,
  type DateParts,
} from './calendar-model';
import styles from './calendar.module.css';

const panelWidth = 292;

type PanelProps = {
  menuRef: RefObject<HTMLDivElement | null>;
  anchor: RefObject<HTMLButtonElement | null>;
  rootRef: RefObject<HTMLDivElement | null>;
  menuId: string;
  label: string;
  mode: CalendarMode;
  value: string;
  required: boolean;
  locale: string;
  onChange: (value: string, close: boolean) => void;
  onClose: () => void;
};

export function CalendarPanel({
  menuRef,
  anchor,
  rootRef,
  menuId,
  label,
  onClose,
  mode,
  value,
  required,
  locale,
  onChange,
}: PanelProps): ReactElement | null {
  const box = useAnchoredBox(anchor, menuRef, { limit: 640, clip: false, contain: true });
  useMenuDismiss(true, rootRef, menuRef, onClose);
  if (typeof document === 'undefined') {
    return null;
  }
  return createPortal(
    <div
      ref={menuRef}
      id={menuId}
      className={styles.panel}
      role="dialog"
      aria-label={label}
      style={panelStyle(box)}
    >
      <CalendarBody
        mode={mode}
        value={value}
        required={required}
        locale={locale}
        onChange={onChange}
        onClose={onClose}
      />
    </div>,
    document.body,
  );
}

function CalendarBody({
  mode,
  value,
  required,
  locale,
  onChange,
  onClose,
}: {
  mode: CalendarMode;
  value: string;
  required: boolean;
  locale: string;
  onChange: (next: string, close: boolean) => void;
  onClose: () => void;
}): ReactElement {
  const t = useTranslations('calendar');
  const parsed = parseDateTime(value);
  const initial = parsed ?? todayParts();
  const [cursor, setCursor] = useState({ year: initial.year, month: initial.month });
  const selected = parsed === null ? '' : dateValue(parsed);
  const today = dateValue(todayParts());
  const start = weekStartsOn(locale);

  function pick(day: string): void {
    if (mode === 'date') {
      onChange(day, true);
      return;
    }
    const time = parsed ?? todayParts();
    onChange(withTime(day, time.hour, time.minute), false);
  }

  return (
    <>
      <MonthBar
        title={monthTitle(cursor.year, cursor.month, locale)}
        previousLabel={t('previousMonth')}
        nextLabel={t('nextMonth')}
        onShift={(delta) => setCursor((current) => shiftMonth(current.year, current.month, delta))}
      />
      <DayGrid
        labels={weekdayLabels(locale, start)}
        cells={buildMonth(cursor.year, cursor.month, start)}
        selected={selected}
        today={today}
        onPick={pick}
      />
      {mode === 'datetime' && parsed !== null ? (
        <TimeFields
          parts={parsed}
          hourLabel={t('hour')}
          minuteLabel={t('minute')}
          onChange={onChange}
        />
      ) : null}
      <div className={styles.foot}>
        <button type="button" className={styles.textButton} onClick={() => pick(today)}>
          {t('today')}
        </button>
        {required || value === '' ? null : (
          <button type="button" className={styles.textButton} onClick={() => onChange('', true)}>
            {t('clear')}
          </button>
        )}
        {mode === 'datetime' ? (
          <button type="button" className={styles.textButton} onClick={onClose}>
            {t('done')}
          </button>
        ) : null}
      </div>
    </>
  );
}

function MonthBar({
  title,
  previousLabel,
  nextLabel,
  onShift,
}: {
  title: string;
  previousLabel: string;
  nextLabel: string;
  onShift: (delta: number) => void;
}): ReactElement {
  return (
    <div className={styles.head}>
      <button
        type="button"
        className={styles.nav}
        aria-label={previousLabel}
        onClick={() => onShift(-1)}
      >
        <Chevron direction="left" />
      </button>
      <p className={styles.month}>{title}</p>
      <button
        type="button"
        className={styles.nav}
        aria-label={nextLabel}
        onClick={() => onShift(1)}
      >
        <Chevron direction="right" />
      </button>
    </div>
  );
}

function DayGrid({
  labels,
  cells,
  selected,
  today,
  onPick,
}: {
  labels: string[];
  cells: ReturnType<typeof buildMonth>;
  selected: string;
  today: string;
  onPick: (day: string) => void;
}): ReactElement {
  return (
    <>
      <div className={styles.week}>
        {labels.map((label, index) => (
          <span key={`${label}-${String(index)}`} className={styles.weekday}>
            {label}
          </span>
        ))}
      </div>
      <div className={styles.days}>
        {cells.map((cell) => (
          <button
            key={cell.key}
            type="button"
            className={dayClass(cell.inMonth, cell.value === selected, cell.value === today)}
            aria-pressed={cell.value === selected}
            onClick={() => onPick(cell.value)}
          >
            {cell.day}
          </button>
        ))}
      </div>
    </>
  );
}

function TimeFields({
  parts,
  hourLabel,
  minuteLabel,
  onChange,
}: {
  parts: DateParts;
  hourLabel: string;
  minuteLabel: string;
  onChange: (value: string, close: boolean) => void;
}): ReactElement {
  function commit(hour: number, minute: number): void {
    onChange(dateTimeValue({ ...parts, hour, minute }), false);
  }
  return (
    <div className={styles.time}>
      <label>
        {hourLabel}
        <input
          type="number"
          min={0}
          max={23}
          value={parts.hour}
          onChange={(event) => commit(readUnit(event.target.value, 23), parts.minute)}
        />
      </label>
      <label>
        {minuteLabel}
        <input
          type="number"
          min={0}
          max={59}
          value={parts.minute}
          onChange={(event) => commit(parts.hour, readUnit(event.target.value, 59))}
        />
      </label>
    </div>
  );
}

function dayClass(inMonth: boolean, selected: boolean, today: boolean): string {
  const names = [styles.day];
  if (!inMonth) {
    names.push(styles.dayOut);
  }
  if (today) {
    names.push(styles.dayToday);
  }
  if (selected) {
    names.push(styles.dayOn);
  }
  return names.join(' ');
}

function panelStyle(box: AnchoredBox): CSSProperties {
  const style = anchoredStyle(box, 'width');
  const left =
    typeof style.left === 'number'
      ? Math.max(8, Math.min(style.left, window.innerWidth - panelWidth - 8))
      : style.left;
  return { ...style, width: panelWidth, left };
}

function Chevron({ direction }: { direction: 'left' | 'right' }): ReactElement {
  const path = direction === 'left' ? 'M9 3.5 4.5 8 9 12.5' : 'M7 3.5 11.5 8 7 12.5';
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}
