'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactElement, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { useAnchoredBox, useMenuDismiss, type AnchoredBox } from '../select/anchored-menu';
import {
  clampByte,
  clampUnit,
  hexToRgb,
  hsvToRgb,
  normalizeHex,
  rgbToHex,
  rgbToHsv,
  type Hsv,
} from './color-model';
import styles from './color-picker.module.css';

const panelWidth = 268;

/** Circular swatch that opens a CRM color panel instead of the browser picker. */
export function ColorField({
  label,
  hueLabel,
  value,
  onChange,
}: {
  label: string;
  hueLabel: string;
  value: string;
  onChange: (hex: string) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const hex = normalizeHex(value);
  useMenuDismiss(open, rootRef, menuRef, () => setOpen(false));
  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.swatch}
        style={{ background: hex }}
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((next) => !next)}
      />
      {open ? (
        <ColorPanel
          menuRef={menuRef}
          anchor={buttonRef}
          rootRef={rootRef}
          menuId={menuId}
          label={label}
          hueLabel={hueLabel}
          value={hex}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function ColorPanel({
  menuRef,
  anchor,
  rootRef,
  menuId,
  label,
  hueLabel,
  value,
  onChange,
  onClose,
}: {
  menuRef: RefObject<HTMLDivElement | null>;
  anchor: RefObject<HTMLButtonElement | null>;
  rootRef: RefObject<HTMLDivElement | null>;
  menuId: string;
  label: string;
  hueLabel: string;
  value: string;
  onChange: (hex: string) => void;
  onClose: () => void;
}): ReactElement | null {
  const box = useAnchoredBox(anchor, menuRef, { limit: 420, clip: false, contain: true });
  const [hsv, setHsv] = useState(() => rgbToHsv(hexToRgb(value)));
  useMenuDismiss(true, rootRef, menuRef, onClose);
  useEscapeClose(onClose);
  if (typeof document === 'undefined') return null;
  const commit = (next: Hsv): void => {
    setHsv(next);
    onChange(rgbToHex(hsvToRgb(next)));
  };
  return createPortal(
    <div
      ref={menuRef}
      id={menuId}
      className={styles.panel}
      role="dialog"
      aria-label={label}
      style={panelStyle(box, anchor.current)}
    >
      <SaturationField hsv={hsv} onDraft={setHsv} onCommit={commit} />
      <HueSlider hsv={hsv} label={hueLabel} onDraft={setHsv} onCommit={commit} />
      <RgbFields hsv={hsv} onCommit={commit} />
    </div>,
    document.body,
  );
}

function panelStyle(box: AnchoredBox, anchor: HTMLElement | null): CSSProperties {
  const left = Math.max(8, sheetEdge(anchor) - panelWidth);
  if (!box.upward) return { top: box.top, left, width: panelWidth };
  return { top: 'auto', bottom: window.innerHeight - box.top, left, width: panelWidth };
}

function sheetEdge(anchor: HTMLElement | null): number {
  const sheet = anchor?.closest('[role="dialog"]');
  if (sheet instanceof HTMLElement) return sheet.getBoundingClientRect().right;
  return window.innerWidth - 8;
}

function useEscapeClose(onClose: () => void): void {
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
      const node = document.activeElement;
      if (node instanceof HTMLElement) node.blur();
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);
}

function SaturationField({
  hsv,
  onDraft,
  onCommit,
}: {
  hsv: Hsv;
  onDraft: (next: Hsv) => void;
  onCommit: (next: Hsv) => void;
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const hue = rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));
  return (
    <div
      ref={ref}
      className={styles.plane}
      style={{ backgroundColor: hue }}
      onPointerDown={(event) => dragPlane(event, ref, hsv.h, onDraft, onCommit)}
    >
      <span
        className={styles.thumb}
        style={{
          left: `${hsv.s * 100}%`,
          top: `${(1 - hsv.v) * 100}%`,
          background: rgbToHex(hsvToRgb(hsv)),
        }}
      />
    </div>
  );
}

function dragPlane(
  event: ReactPointerEvent<HTMLDivElement>,
  ref: RefObject<HTMLDivElement | null>,
  hue: number,
  onDraft: (next: Hsv) => void,
  onCommit: (next: Hsv) => void,
): void {
  event.preventDefault();
  const read = (pointer: PointerEvent): Hsv => readPlane(ref.current, pointer, hue);
  onDraft(read(event.nativeEvent));
  const move = (pointer: PointerEvent): void => onDraft(read(pointer));
  const stop = (pointer: PointerEvent): void => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', stop);
    onCommit(read(pointer));
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', stop);
}

function readPlane(node: HTMLDivElement | null, pointer: PointerEvent, hue: number): Hsv {
  if (node === null) return { h: hue, s: 0, v: 0 };
  const rect = node.getBoundingClientRect();
  return {
    h: hue,
    s: clampUnit((pointer.clientX - rect.left) / (rect.width || 1)),
    v: clampUnit(1 - (pointer.clientY - rect.top) / (rect.height || 1)),
  };
}

function HueSlider({
  hsv,
  label,
  onDraft,
  onCommit,
}: {
  hsv: Hsv;
  label: string;
  onDraft: (next: Hsv) => void;
  onCommit: (next: Hsv) => void;
}): ReactElement {
  const thumb = rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));
  const preview = rgbToHex(hsvToRgb(hsv));
  function at(raw: string): Hsv {
    return { ...hsv, h: Number(raw) };
  }
  return (
    <div className={styles.hueRow}>
      <span className={styles.preview} style={{ background: preview }} />
      <input
        className={styles.hue}
        style={{ '--thumb': thumb } as CSSProperties}
        type="range"
        min={0}
        max={360}
        step={1}
        aria-label={label}
        value={Math.round(hsv.h)}
        onChange={(event) => onDraft(at(event.currentTarget.value))}
        onPointerUp={(event) => onCommit(at(event.currentTarget.value))}
        onKeyUp={(event) => onCommit(at(event.currentTarget.value))}
      />
    </div>
  );
}

function RgbFields({ hsv, onCommit }: { hsv: Hsv; onCommit: (next: Hsv) => void }): ReactElement {
  const rgb = hsvToRgb(hsv);
  function commit(channel: 'r' | 'g' | 'b', raw: string): void {
    onCommit(rgbToHsv({ ...rgb, [channel]: clampByte(Number.parseInt(raw, 10)) }));
  }
  return (
    <div className={styles.channels}>
      <Channel label="R" value={rgb.r} onCommit={(raw) => commit('r', raw)} />
      <Channel label="G" value={rgb.g} onCommit={(raw) => commit('g', raw)} />
      <Channel label="B" value={rgb.b} onCommit={(raw) => commit('b', raw)} />
    </div>
  );
}

function Channel({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (raw: string) => void;
}): ReactElement {
  return (
    <label>
      <input
        inputMode="numeric"
        defaultValue={value}
        key={value}
        aria-label={label}
        onBlur={(event) => onCommit(event.currentTarget.value)}
      />
      {label}
    </label>
  );
}
