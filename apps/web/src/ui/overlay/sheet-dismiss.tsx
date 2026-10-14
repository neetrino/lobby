'use client';

import { createContext, useContext, type ReactNode } from 'react';

const SheetDismissContext = createContext<(() => void) | null>(null);

/** Lets a sheet close through the overlay's exit animation. */
export function SheetDismissProvider({
  dismiss,
  children,
}: {
  dismiss: () => void;
  children: ReactNode;
}): ReactNode {
  return <SheetDismissContext.Provider value={dismiss}>{children}</SheetDismissContext.Provider>;
}

export function useInSheet(): boolean {
  return useContext(SheetDismissContext) !== null;
}

/** Animated dismiss when a sheet is open, otherwise the caller's own close. */
export function useSheetDismiss(fallback: () => void): () => void {
  return useContext(SheetDismissContext) ?? fallback;
}
