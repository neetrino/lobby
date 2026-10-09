'use client';

import { useState } from 'react';

import {
  EMPTY_DRAFT,
  draftFromContact,
  type Contact,
  type ContactDraft,
  type ContactWarning,
} from './contact';
import {
  archiveContact,
  createContact,
  readContact,
  restoreContact,
  toRequestError,
  updateContact,
  type ContactsRequestError,
} from './contacts-api';

export function useContactEditor(reload: () => void): {
  mode: 'closed' | 'create' | 'edit';
  contact: Contact | null;
  draft: ContactDraft;
  pending: boolean;
  error: ContactsRequestError | null;
  warnings: ContactWarning[];
  placement: 'inline' | 'portal';
  openCreate: () => void;
  openContact: (contact: Contact) => void;
  openEditor: (contact: Contact) => void;
  openDuplicate: (contactId: string) => Promise<void>;
  close: () => void;
  setDraft: (draft: ContactDraft) => void;
  save: () => Promise<SaveResult>;
  changeArchive: (
    contact: Contact,
    archived: boolean,
    options?: { reload?: boolean },
  ) => Promise<MutationResult>;
  dismissWarnings: () => void;
} {
  const [mode, setMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [placement, setPlacement] = useState<'inline' | 'portal'>('inline');
  const [contact, setContact] = useState<Contact | null>(null);
  const [draft, setDraft] = useState<ContactDraft>(EMPTY_DRAFT);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ContactsRequestError | null>(null);
  const [warnings, setWarnings] = useState<ContactWarning[]>([]);

  function openCreate(): void {
    setPlacement('inline');
    setMode('create');
    setContact(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  function openContact(next: Contact): void {
    showContact(next, 'inline', setPlacement, setMode, setContact, setDraft, setError);
  }

  function openEditor(next: Contact): void {
    showContact(next, 'portal', setPlacement, setMode, setContact, setDraft, setError);
  }

  function close(): void {
    setMode('closed');
    setContact(null);
    setError(null);
  }

  async function openDuplicate(contactId: string): Promise<void> {
    setPending(true);
    setError(null);
    try {
      openContact(await readContact(contactId));
    } catch (caught) {
      setError(toRequestError(caught));
    } finally {
      setPending(false);
    }
  }

  async function save(): Promise<SaveResult> {
    const created = mode === 'create';
    setPending(true);
    setError(null);
    try {
      const written = created ? await createContact(draft) : await updateLoaded(contact, draft);
      setWarnings(written.warnings);
      close();
      reload();
      return { ok: true, created };
    } catch (caught) {
      const error = toRequestError(caught);
      setError(error);
      return { ok: false, error };
    } finally {
      setPending(false);
    }
  }

  async function changeArchive(
    target: Contact,
    archived: boolean,
    options?: { reload?: boolean },
  ): Promise<MutationResult> {
    setPending(true);
    setError(null);
    try {
      await (archived ? archiveContact(target.id) : restoreContact(target.id));
      if (contact?.id === target.id) {
        close();
      }
      if (options?.reload !== false) {
        reload();
      }
      return { ok: true };
    } catch (caught) {
      const error = toRequestError(caught);
      setError(error);
      return { ok: false, error };
    } finally {
      setPending(false);
    }
  }

  return {
    mode,
    placement,
    contact,
    draft,
    pending,
    error,
    warnings,
    openCreate,
    openContact,
    openEditor,
    openDuplicate,
    close,
    setDraft,
    save,
    changeArchive,
    dismissWarnings: () => setWarnings([]),
  };
}

export type MutationResult = { ok: true } | { ok: false; error: ContactsRequestError };

export type SaveResult =
  { ok: true; created: boolean } | { ok: false; error: ContactsRequestError };

function showContact(
  next: Contact,
  nextPlacement: 'inline' | 'portal',
  setPlacement: (placement: 'inline' | 'portal') => void,
  setMode: (mode: 'closed' | 'create' | 'edit') => void,
  setContact: (contact: Contact) => void,
  setDraft: (draft: ContactDraft) => void,
  setError: (error: ContactsRequestError | null) => void,
): void {
  setPlacement(nextPlacement);
  setMode('edit');
  setContact(next);
  setDraft(draftFromContact(next));
  setError(null);
}

async function updateLoaded(
  contact: Contact | null,
  draft: ContactDraft,
): Promise<{ contact: Contact; warnings: ContactWarning[] }> {
  if (contact === null) {
    throw new Error('Contact is not loaded.');
  }
  return updateContact(contact.id, draft);
}
