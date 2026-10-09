'use client';

import { type FormEvent } from 'react';
import { useTranslations } from 'next-intl';

import type { PipelineStatus } from './pipeline-api';
import styles from './pipeline.module.css';

export function PipelineToolbar({
  query,
  statusId,
  statuses,
  canConfigure,
  onQuery,
  onStatus,
  onClear,
  onCreate,
  onRename,
  onRecolor,
  onDelete,
}: {
  query: string;
  statusId: string;
  statuses: PipelineStatus[];
  canConfigure: boolean;
  onQuery: (query: string) => void;
  onStatus: (statusId: string) => void;
  onClear: () => void;
  onCreate: (draft: { name: string; color: string }) => void;
  onRename: (statusId: string, name: string) => void;
  onRecolor: (statusId: string, color: string) => void;
  onDelete: (statusId: string) => void;
}) {
  const t = useTranslations('pipeline');
  return (
    <div className={styles.tools}>
      <input
        className={styles.search}
        type="search"
        aria-label={t('search')}
        placeholder={t('search')}
        value={query}
        onChange={(event) => onQuery(event.currentTarget.value)}
      />
      <select aria-label={t('status')} value={statusId} onChange={(event) => onStatus(event.currentTarget.value)}>
        <option value="">{t('allStatuses')}</option>
        {statuses.map((status) => (
          <option key={status.id} value={status.id}>{status.name}</option>
        ))}
      </select>
      <button type="button" className={styles.add} onClick={onClear}>{t('clearFilters')}</button>
      {canConfigure ? (
        <StatusEditor statuses={statuses} onCreate={onCreate} onRename={onRename} onRecolor={onRecolor} onDelete={onDelete} />
      ) : null}
    </div>
  );
}

function StatusEditor({
  statuses,
  onCreate,
  onRename,
  onRecolor,
  onDelete,
}: {
  statuses: PipelineStatus[];
  onCreate: (draft: { name: string; color: string }) => void;
  onRename: (statusId: string, name: string) => void;
  onRecolor: (statusId: string, color: string) => void;
  onDelete: (statusId: string) => void;
}) {
  const t = useTranslations('pipeline');
  return (
    <div className={styles.statusEditor}>
      {statuses.map((status) => (
        <div key={status.id} className={styles.statusRow}>
          <input
            aria-label={t('statusName')}
            defaultValue={status.name}
            key={status.name}
            maxLength={40}
            onBlur={(event) => commitStatusName(event.currentTarget.value, status, onRename)}
          />
          <input
            aria-label={t('statusColor')}
            type="color"
            defaultValue={status.color}
            onBlur={(event) => commitStatusColor(event.currentTarget.value, status, onRecolor)}
          />
          <button type="button" className={styles.iconButton} aria-label={t('deleteStatus')} onClick={() => onDelete(status.id)}>
            ×
          </button>
        </div>
      ))}
      <form className={styles.statusRow} onSubmit={(event) => submitStatus(event, onCreate)}>
        <input name="name" aria-label={t('statusName')} placeholder={t('statusName')} maxLength={40} required />
        <input name="color" aria-label={t('statusColor')} type="color" defaultValue="#2563eb" />
        <button type="submit" className={styles.add}>{t('addStatus')}</button>
      </form>
    </div>
  );
}

function commitStatusColor(
  value: string,
  status: PipelineStatus,
  onRecolor: (statusId: string, color: string) => void,
): void {
  if (value.toLowerCase() !== status.color) {
    onRecolor(status.id, value);
  }
}

function commitStatusName(value: string, status: PipelineStatus, onRename: (statusId: string, name: string) => void): void {
  const name = value.trim();
  if (name !== '' && name !== status.name) {
    onRename(status.id, name);
  }
}

function submitStatus(event: FormEvent<HTMLFormElement>, onCreate: (draft: { name: string; color: string }) => void): void {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const name = String(data.get('name') ?? '').trim();
  const color = String(data.get('color') ?? '#2563eb');
  if (name === '') {
    return;
  }
  onCreate({ name, color });
  event.currentTarget.reset();
}
