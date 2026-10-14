'use client';

import { useEffect, useRef, type ReactElement } from 'react';

import styles from './checkbox.module.css';

/** Rounded checkbox. The native input stays for the keyboard and the label click. */
export function Checkbox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label?: string;
  onChange: () => void;
}): ReactElement {
  const ref = useRef<HTMLInputElement>(null);
  const mixed = indeterminate && !checked;
  useEffect(() => {
    if (ref.current !== null) {
      ref.current.indeterminate = mixed;
    }
  }, [mixed]);
  return (
    <span className={styles.box}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        aria-checked={mixed ? 'mixed' : checked}
        aria-label={label}
        onChange={onChange}
      />
      <span className={styles.mark} aria-hidden="true" />
    </span>
  );
}
