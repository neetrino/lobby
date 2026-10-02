'use client';

import { useState } from 'react';

import type { Contact } from './contact';

/** Checkbox selection limited to the contacts currently on the page. */
export function usePageSelection(rows: readonly Contact[]): {
  picked: Contact[];
  allPicked: boolean;
  somePicked: boolean;
  isPicked: (id: string) => boolean;
  toggle: (id: string) => void;
  togglePage: () => void;
  clear: () => void;
} {
  const [pickedIds, setPickedIds] = useState<readonly string[]>([]);
  const picked = rows.filter((row) => pickedIds.includes(row.id));
  const pageIds = rows.map((row) => row.id);

  return {
    picked,
    allPicked: rows.length > 0 && picked.length === rows.length,
    somePicked: picked.length > 0 && picked.length < rows.length,
    isPicked: (id) => pickedIds.includes(id),
    toggle: (id) => setPickedIds((current) => toggleId(current, id)),
    togglePage: () => setPickedIds((current) => togglePageIds(current, pageIds)),
    clear: () => setPickedIds([]),
  };
}

function toggleId(current: readonly string[], id: string): string[] {
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

function togglePageIds(current: readonly string[], pageIds: readonly string[]): string[] {
  const all = pageIds.length > 0 && pageIds.every((id) => current.includes(id));
  if (all) {
    return current.filter((id) => !pageIds.includes(id));
  }
  return [...new Set([...current, ...pageIds])];
}
