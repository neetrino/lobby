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
  const place = useCallback(() => {
    const thumb = thumbRef.current;
    const selected = rootRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (thumb === null || selected === null || selected === undefined) {
      return;
    }
    thumb.style.width = `${selected.offsetWidth}px`;
    thumb.style.transform = `translate3d(${selected.offsetLeft}px, 0, 0)`;
  }, []);

  useLayoutEffect(() => {
    place();
    const ready = styles.ready;
    if (ready !== undefined) {
      thumbRef.current?.classList.add(ready);
    }
  }, [place, value]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      place();
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
    };
  }, [place]);

  return { rootRef, thumbRef };
}
