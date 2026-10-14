'use client';

import { Tags, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';

import { SheetFrame } from '../../ui/side-sheet/side-sheet';
import { FilterMenu } from '../../ui/filter-menu/filter-menu';
import { SearchFilters } from '../../ui/search-filters/search-filters';
import { OverlayPortal } from '../contacts/overlay-portal';
import type { PipelineStatus } from './pipeline-api';
import styles from './pipeline.module.css';

type ToolbarSheet = 'statuses' | 'column';

export function PipelineToolbar({
  query,
  statusId,
  statuses,
  canConfigure,
  onQuery,
  onStatus,
  onCreate,
  onRename,
  onRecolor,
  onDelete,
  onCreateColumn,
}: {
  query: string;
  statusId: string;
  statuses: PipelineStatus[];
  canConfigure: boolean;
  onQuery: (query: string) => void;
  onStatus: (statusId: string) => void;
  onCreate: (draft: { name: string; color: string }) => void;
  onRename: (statusId: string, name: string) => void;
  onRecolor: (statusId: string, color: string) => void;
  onDelete: (statusId: string) => void;
  onCreateColumn: (name: string) => void;
}) {
  const t = useTranslations('pipeline');
  const [sheet, setSheet] = useState<ToolbarSheet | null>(null);
  return (
    <div className={styles.tools}>
      <SearchFilters
        value={query}
        onChange={onQuery}
        placeholder={t('search')}
        label={t('search')}
      />
      <FilterMenu
        label={t('status')}
        value={statusId}
        options={[
          { value: '', label: t('allStatuses') },
          ...statuses.map((status) => ({ value: status.id, label: status.name })),
        ]}
        onChange={onStatus}
      />
      <BoardActions canConfigure={canConfigure} onOpen={setSheet} />
      {sheet === 'statuses' ? (
        <StatusSheet
          statuses={statuses}
          onClose={() => setSheet(null)}
          onCreate={onCreate}
          onRename={onRename}
          onRecolor={onRecolor}
          onDelete={onDelete}
        />
      ) : null}
      {sheet === 'column' ? (
        <ColumnSheet onClose={() => setSheet(null)} onCreate={onCreateColumn} />
      ) : null}
    </div>
  );
}

function BoardActions({
  canConfigure,
  onOpen,
}: {
  canConfigure: boolean;
  onOpen: (sheet: ToolbarSheet) => void;
}) {
  const t = useTranslations('pipeline');
  if (!canConfigure) return null;
  return (
    <div className={styles.boardActions}>
      <button type="button" className={styles.statuses} data-tone="primary" onClick={() => onOpen('column')}>
        {t('addColumnShort')}
      </button>
      <button type="button" className={styles.statuses} data-tone="primary" onClick={() => onOpen('statuses')}>
        <Tags aria-hidden="true" />
        {t('statuses')}
      </button>
    </div>
  );
}

function StatusSheet({
  onClose,
  ...editor
}: {
  statuses: PipelineStatus[];
  onClose: () => void;
  onCreate: (draft: { name: string; color: string }) => void;
  onRename: (statusId: string, name: string) => void;
  onRecolor: (statusId: string, color: string) => void;
  onDelete: (statusId: string) => void;
}) {
  const t = useTranslations('pipeline');
  return (
    <OverlayPortal onDismiss={onClose}>
      <SheetFrame label={t('statuses')} closeLabel={t('close')}>
        <StatusEditor {...editor} />
      </SheetFrame>
    </OverlayPortal>
  );
}

function ColumnSheet({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const t = useTranslations('pipeline');
  return (
    <OverlayPortal onDismiss={onClose}>
      <SheetFrame label={t('addColumn')} closeLabel={t('close')}>
        <form className={styles.columnSheet} onSubmit={(event) => submitColumn(event, onCreate, onClose)}>
          <header className={styles.statusHead}>
            <h2>{t('addColumn')}</h2>
          </header>
          <label className={styles.field}>
            {t('columnName')}
            <input name="name" aria-label={t('columnName')} placeholder={t('columnName')} required maxLength={40} />
          </label>
          <button type="submit" className={styles.add}>
            {t('save')}
          </button>
        </form>
      </SheetFrame>
    </OverlayPortal>
  );
}

function submitColumn(
  event: FormEvent<HTMLFormElement>,
  onCreate: (name: string) => void,
  onClose: () => void,
): void {
  event.preventDefault();
  const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
  if (name === '') return;
  onCreate(name);
  onClose();
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
      <header className={styles.statusHead}>
        <h2>{t('statuses')}</h2>
      </header>
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
          <button
            type="button"
            className={styles.iconButton}
            aria-label={t('deleteStatus')}
            onClick={() => onDelete(status.id)}
          >
            <X aria-hidden="true" strokeWidth={2} />
          </button>
        </div>
      ))}
      <form className={styles.statusRow} onSubmit={(event) => submitStatus(event, onCreate)}>
        <input
          name="name"
          aria-label={t('statusName')}
          placeholder={t('statusName')}
          maxLength={40}
          required
        />
        <input name="color" aria-label={t('statusColor')} type="color" defaultValue="#2563eb" />
        <button type="submit" className={styles.add}>
          {t('addStatus')}
        </button>
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

function commitStatusName(
  value: string,
  status: PipelineStatus,
  onRename: (statusId: string, name: string) => void,
): void {
  const name = value.trim();
  if (name !== '' && name !== status.name) {
    onRename(status.id, name);
  }
}

function submitStatus(
  event: FormEvent<HTMLFormElement>,
  onCreate: (draft: { name: string; color: string }) => void,
): void {
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
