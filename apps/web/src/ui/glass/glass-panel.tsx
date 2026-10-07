import type { ComponentPropsWithoutRef } from 'react';

import styles from './glass.module.css';

type GlassPanelProps = ComponentPropsWithoutRef<'div'> & {
  strength?: 'soft' | 'medium' | 'strong';
};

/** Translucent surface. Text stays on the panel, not on the blurred page behind it. */
export function GlassPanel({
  strength = 'medium',
  className = '',
  ...props
}: GlassPanelProps) {
  return <div className={`${styles.panel} ${styles[strength]} ${className}`} {...props} />;
}
