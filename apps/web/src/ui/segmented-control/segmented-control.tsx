'use client';

import {
  useCallback,
  useLayoutEffect,
  useRef,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';

import styles from './segmented-control.module.css';

/** Pill switch shared across the app. The selected thumb slides between options. */
export function SegmentedControl<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  onChange: (value: T) => void;
}): ReactElement {
  const { rootRef, thumbRef } = useSlidingThumb(value);
  return (
    <div className={styles.track} role="group" aria-label={label} ref={rootRef}>
      <span className={styles.thumb} ref={thumbRef} aria-hidden="true" />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            className={selected ? styles.on : styles.off}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function useSlidingThumb(value: string | number): {
  rootRef: RefObject<HTMLDivElement | null>;
  thumbRef: RefObject<HTMLSpanElement | null>;
} {
  const rootRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const motionReady = useRef(false);
  const place = useCallback((animate: boolean) => {
    moveThumb(thumbRef.current, selectedButton(rootRef.current), animate);
  }, []);

  useLayoutEffect(() => {
    const animate = motionReady.current;
    place(animate);
    motionReady.current = true;
    if (!animate) {
      showThumb(thumbRef.current);
    }
  }, [place, value]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      place(false);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [place]);

  return { rootRef, thumbRef };
}

function selectedButton(root: HTMLDivElement | null): HTMLButtonElement | null {
  return root?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ?? null;
}

/** Resize and first mount must not slide the thumb in from the left edge. */
function moveThumb(
  thumb: HTMLSpanElement | null,
  selected: HTMLButtonElement | null,
  animate: boolean,
): void {
  if (thumb === null || selected === null) {
    return;
  }
  if (!animate) {
    thumb.style.transition = 'none';
  }
  thumb.style.width = `${selected.offsetWidth}px`;
  thumb.style.transform = `translate3d(${selected.offsetLeft}px, 0, 0)`;
  if (!animate) {
    void thumb.offsetWidth;
    thumb.style.transition = '';
  }
}

function showThumb(thumb: HTMLSpanElement | null): void {
  const ready = styles.ready;
  if (thumb !== null && ready !== undefined) {
    thumb.classList.add(ready);
  }
}
