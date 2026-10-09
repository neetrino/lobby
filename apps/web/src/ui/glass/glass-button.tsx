import type { ComponentPropsWithoutRef } from 'react';

import styles from './glass.module.css';

type GlassButtonProps = ComponentPropsWithoutRef<'button'> & {
  tone?: 'primary' | 'secondary';
};

/** Glass action. Primary is the filled action; secondary stays light enough to read. */
export function GlassButton({
  tone = 'primary',
  className = '',
  type = 'button',
  ...props
}: GlassButtonProps) {
  return <button type={type} className={`${styles.button} ${styles[tone]} ${className}`} {...props} />;
}
