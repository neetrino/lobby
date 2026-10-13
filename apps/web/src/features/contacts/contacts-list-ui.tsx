'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export type ContactColumn = 'details' | 'owner' | 'status' | 'created';
export type ContactDensity = 'compact' | 'comfortable';

const COLUMNS: ContactColumn[] = ['details', 'owner', 'status', 'created'];

type ListUi = {
  density: ContactDensity;
  setDensity: (density: ContactDensity) => void;
  columns: Record<ContactColumn, boolean>;
  toggleColumn: (column: ContactColumn) => void;
};

const ListUiContext = createContext<ListUi | null>(null);

export function ContactsListUi({ children }: { children: ReactNode }) {
  const [density, setDensity] = useState<ContactDensity>('compact');
  const [columns, setColumns] = useState<Record<ContactColumn, boolean>>({
    details: true,
    owner: true,
    status: true,
    created: true,
  });

  function toggleColumn(column: ContactColumn): void {
    setColumns((current) => ({ ...current, [column]: !current[column] }));
  }

  return (
    <ListUiContext.Provider value={{ density, setDensity, columns, toggleColumn }}>
      {children}
    </ListUiContext.Provider>
  );
}

export function useContactsListUi(): ListUi {
  return useContext(ListUiContext) ?? fallbackUi;
}

const fallbackUi: ListUi = {
  density: 'compact',
  setDensity: () => undefined,
  columns: { details: true, owner: true, status: true, created: true },
  toggleColumn: () => undefined,
};

export function contactColumns(): readonly ContactColumn[] {
  return COLUMNS;
}
