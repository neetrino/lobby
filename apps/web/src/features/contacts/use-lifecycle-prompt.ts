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
  | {
      ok: false;
      error: ContactsRequestError;
      action: LifecycleAction;
      completed: number;
      total: number;
    }
  | null;

type ChangeArchive = (
  contact: Contact,
  archived: boolean,
  options?: { reload?: boolean },
) => Promise<MutationResult>;

/** Holds an archive or restore request until the user confirms it. */
export function useLifecyclePrompt(
  changeArchive: ChangeArchive,
  reload: () => void,
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
    confirm: () => confirmPrompt(prompt, changeArchive, reload, setPrompt, setFailed),
    cancel: () => {
      setFailed(false);
      setPrompt(null);
    },
  };
}

async function confirmPrompt(
  prompt: LifecyclePrompt | null,
  changeArchive: ChangeArchive,
  reload: () => void,
  setPrompt: (prompt: LifecyclePrompt | null) => void,
  setFailed: (failed: boolean) => void,
): Promise<LifecycleResult> {
  if (prompt === null || prompt.contacts[0] === undefined) {
    return null;
  }
  const archive = prompt.action === 'archive';
  let completed = 0;
  for (const contact of prompt.contacts) {
    const saved = await changeArchive(contact, archive, { reload: false });
    if (!saved.ok) {
      if (completed > 0) {
        reload();
      }
      setFailed(true);
      setPrompt({ ...prompt, contacts: prompt.contacts.slice(completed) });
      return {
        ok: false,
        error: saved.error,
        action: prompt.action,
        completed,
        total: prompt.contacts.length,
      };
    }
    completed += 1;
  }
  setFailed(false);
  setPrompt(null);
  reload();
  return {
    ok: true,
    action: prompt.action,
    count: prompt.contacts.length,
    name: prompt.contacts[0].name,
  };
}
