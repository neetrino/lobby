'use client';

import { useState } from 'react';

import type { Contact } from './contact';
import type { ContactsRequestError } from './contacts-api';
import type { MutationResult } from './use-contact-editor';

export type LifecycleAction = 'archive' | 'restore';

export type LifecyclePrompt = {
  contacts: Contact[];
  action: LifecycleAction;
};

export type LifecycleResult =
  | { ok: true; action: LifecycleAction; count: number; name: string }
  | { ok: false; error: ContactsRequestError }
  | null;

/** Holds an archive or restore request until the user confirms it. */
export function useLifecyclePrompt(
  changeArchive: (contact: Contact, archived: boolean) => Promise<MutationResult>,
): {
  prompt: LifecyclePrompt | null;
  failed: boolean;
  ask: (contacts: readonly Contact[], action: LifecycleAction) => void;
  confirm: () => Promise<LifecycleResult>;
  cancel: () => void;
} {
  const [prompt, setPrompt] = useState<LifecyclePrompt | null>(null);
  const [failed, setFailed] = useState(false);

  return {
    prompt,
    failed,
    ask: (contacts, action) => {
      setFailed(false);
      setPrompt({ contacts: [...contacts], action });
    },
    confirm: () => confirmPrompt(prompt, changeArchive, setPrompt, setFailed),
    cancel: () => {
      setFailed(false);
      setPrompt(null);
    },
  };
}

async function confirmPrompt(
  prompt: LifecyclePrompt | null,
  changeArchive: (contact: Contact, archived: boolean) => Promise<MutationResult>,
  setPrompt: (prompt: LifecyclePrompt | null) => void,
  setFailed: (failed: boolean) => void,
): Promise<LifecycleResult> {
  if (prompt === null || prompt.contacts[0] === undefined) {
    return null;
  }
  const archive = prompt.action === 'archive';
  for (const contact of prompt.contacts) {
    const saved = await changeArchive(contact, archive);
    if (!saved.ok) {
      setFailed(true);
      return saved;
    }
  }
  setFailed(false);
  setPrompt(null);
  return {
    ok: true,
    action: prompt.action,
    count: prompt.contacts.length,
    name: prompt.contacts[0].name,
  };
}
