'use client';

import { useEffect, useId, useRef, useState, type ReactElement, type RefObject } from 'react';
import { useTranslations } from 'next-intl';

import { canManageLifecycle, type Contact, type SessionPrincipal } from './contact';
import styles from './contacts-table.module.css';

export function ContactRowActions({
  contact,
  session,
  onView,
  onEdit,
  onArchive,
  onRestore,
}: {
  contact: Contact;
  session: SessionPrincipal | null;
  onView: (contact: Contact) => void;
  onEdit: (contact: Contact) => void;
  onArchive: (contact: Contact) => void;
  onRestore: (contact: Contact) => void;
}): ReactElement {
  const t = useTranslations('contacts');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useDismiss(open, rootRef, () => setOpen(false));
  const manageable = session !== null && canManageLifecycle(session, contact);
  const archived = contact.archivedAt !== null;

  return (
    <div className={styles.rowActions} ref={rootRef}>
      <IconButton label={t('edit')} onClick={() => onEdit(contact)}>
        <PencilIcon />
      </IconButton>
      <IconButton
        label={t('more')}
        pressed={open}
        controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreIcon />
      </IconButton>
      {open ? (
        <ActionMenu
          menuId={menuId}
          archived={archived}
          manageable={manageable}
          onView={() => onView(contact)}
          onEdit={() => onEdit(contact)}
          onArchive={() => onArchive(contact)}
          onRestore={() => onRestore(contact)}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function ActionMenu({
  menuId,
  archived,
  manageable,
  onView,
  onEdit,
  onArchive,
  onRestore,
  onClose,
}: {
  menuId: string;
  archived: boolean;
  manageable: boolean;
  onView: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onClose: () => void;
}): ReactElement {
  const t = useTranslations('contacts');
  const denied = manageable ? undefined : t('errors.forbidden');
  return (
    <ul className={styles.menu} id={menuId} role="menu">
      <MenuItem label={t('view')} onSelect={onView} close={onClose} />
      <MenuItem label={t('edit')} onSelect={onEdit} close={onClose} />
      {archived ? (
        <MenuItem label={t('restore')} disabled={!manageable} hint={denied} onSelect={onRestore} close={onClose} />
      ) : (
        <MenuItem label={t('archive')} disabled={!manageable} hint={denied} onSelect={onArchive} close={onClose} />
      )}
    </ul>
  );
}

function MenuItem({
  label,
  disabled = false,
  hint,
  onSelect,
  close,
}: {
  label: string;
  disabled?: boolean;
  hint?: string;
  onSelect: () => void;
  close: () => void;
}): ReactElement {
  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        className={styles.menuItem}
        disabled={disabled}
        title={hint}
        onClick={() => {
          if (!disabled) {
            onSelect();
            close();
          }
        }}
      >
        {label}
      </button>
    </li>
  );
}

function IconButton({
  label,
  pressed = false,
  controls,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  controls?: string;
  onClick: () => void;
  children: ReactElement;
}): ReactElement {
  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={label}
      title={label}
      aria-haspopup={controls === undefined ? undefined : 'menu'}
      aria-expanded={controls === undefined ? undefined : pressed}
      aria-controls={controls}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function useDismiss(
  open: boolean,
  rootRef: RefObject<HTMLDivElement | null>,
  close: () => void,
): void {
  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent): void {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) {
        return;
      }
      close();
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        close();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [close, open, rootRef]);
}

function PencilIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h4l10-10-4-4L4 16z" />
      <path d="M13 7l4 4" />
    </svg>
  );
}

function MoreIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
