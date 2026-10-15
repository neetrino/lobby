'use client';

import { useEffect, useState } from 'react';

import styles from './menu-motion.module.css';

const leaveMs = 200;

/** Keeps a menu mounted until its close animation finishes. */
export function usePresence(open: boolean): { present: boolean; leaving: boolean } {
  const [present, setPresent] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const [seen, setSeen] = useState(open);
  if (open !== seen) {
    setSeen(open);
    syncOpen(open, setPresent, setLeaving);
  }
  useEffect(() => {
    if (!leaving) return undefined;
    const timer = window.setTimeout(() => {
      setPresent(false);
      setLeaving(false);
    }, leaveMs);
    return () => window.clearTimeout(timer);
  }, [leaving]);
  return { present, leaving };
}

/** Enter or leave motion. `upward` plays toward the trigger when the menu opens above it. */
export function menuMotionClass(leaving: boolean, upward: boolean): string {
  const names = [leaving ? styles.leaving : styles.enter];
  if (upward) names.push(styles.up);
  return names.join(' ');
}

function syncOpen(
  open: boolean,
  setPresent: (value: boolean) => void,
  setLeaving: (value: boolean) => void,
): void {
  if (open) {
    setPresent(true);
    setLeaving(false);
    return;
  }
  if (prefersReducedMotion()) {
    setPresent(false);
    setLeaving(false);
    return;
  }
  setLeaving(true);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
