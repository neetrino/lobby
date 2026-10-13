'use client';

import glass from '../../ui/glass/glass.module.css';
import { ContactsShell } from './contacts-shell';
import shell from './contacts.module.css';
import { rememberSession } from './remembered-session';
import type { ShellPage } from './sidebar-nav';

export function WorkspaceFallback({ current }: { current: ShellPage }) {
  const session = rememberSession(null);
  return (
    <div className={shell.app}>
      <ContactsShell session={session} current={current} />
      <main className={`${shell.main} ${glass.canvas}`} />
    </div>
  );
}
