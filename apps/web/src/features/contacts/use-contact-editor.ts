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
  openCreate: () => void;
  openContact: (contact: Contact) => void;
  openDuplicate: (contactId: string) => Promise<void>;
  close: () => void;
  setDraft: (draft: ContactDraft) => void;
  save: () => Promise<void>;
  changeArchive: (contact: Contact, archived: boolean) => Promise<void>;
  dismissWarnings: () => void;
} {
  const [mode, setMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [contact, setContact] = useState<Contact | null>(null);
  const [draft, setDraft] = useState<ContactDraft>(EMPTY_DRAFT);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ContactsRequestError | null>(null);
  const [warnings, setWarnings] = useState<ContactWarning[]>([]);

  function openCreate(): void {
    setMode('create');
    setContact(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  function openContact(next: Contact): void {
    setMode('edit');
    setContact(next);
    setDraft(draftFromContact(next));
    setError(null);
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

  async function save(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const written =
        mode === 'create' ? await createContact(draft) : await updateLoaded(contact, draft);
      setWarnings(written.warnings);
      openContact(written.contact);
      reload();
    } catch (caught) {
      setError(toRequestError(caught));
    } finally {
      setPending(false);
    }
  }

  async function changeArchive(target: Contact, archived: boolean): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const next = archived ? await archiveContact(target.id) : await restoreContact(target.id);
      openContact(next);
      reload();
    } catch (caught) {
      setError(toRequestError(caught));
    } finally {
      setPending(false);
    }
  }

  return {
    mode,
    contact,
    draft,
    pending,
    error,
    warnings,
    openCreate,
    openContact,
    openDuplicate,
    close,
    setDraft,
    save,
    changeArchive,
    dismissWarnings: () => setWarnings([]),
  };
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
