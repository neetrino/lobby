'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

import type { ShellPage } from './sidebar-nav';
import { WorkspaceFallback } from './workspace-fallback';

export function lazyWorkspace<P extends object>(
  load: () => Promise<ComponentType<P>>,
  current: ShellPage,
): ComponentType<P> {
  return dynamic(load, {
    loading: () => <WorkspaceFallback current={current} />,
  });
}
