'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';

import { listContacts } from '../contacts/contacts-api';
import type { Contact } from '../contacts/contact';
import glass from '../../ui/glass/glass.module.css';
import type { CardUpdate, PipelineBoard, PipelineCard, PipelineKindName } from './pipeline-api';
import styles from './pipeline.module.css';

const OUTCOMES = ['OPEN', 'WON', 'LOST', 'DISQUALIFIED', 'CONVERTED'] as const;

export function PipelineCardView({
  card,
  index,
  total,
  kind,
  userId,
  amountLabel,
  locale,
  statuses = [],
  stageColors = [],
  stageIndex = 0,
  onSave,
  onDelete,
  onConvert,
}: {
  card: PipelineCard;
  index: number;
  total: number;
  kind: PipelineKindName;
  userId: string | null;
  amountLabel: string;
  locale: string;
  statuses?: PipelineBoard['statuses'];
  stageColors?: string[];
  stageIndex?: number;
  onSave: (patch: CardUpdate) => void;
  onDelete: () => void;
  onConvert: () => void;
}) {
  const t = useTranslations('pipeline');
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  return (
    <article
      className={`${styles.card} ${glass.panel} ${glass.soft}`}
      draggable={!editing}
      onDragStart={(event) => event.dataTransfer.setData('text/plain', card.id)}
    >
      <div className={styles.cardTop}>
        <strong>{card.title}</strong>
        <span className={styles.cardTools}>
          {card.createdByName === null ? null : (
            <span className={styles.avatar} title={card.createdByName} aria-label={card.createdByName}>
              {initials(card.createdByName)}
            </span>
          )}
          <button type="button" className={styles.iconButton} aria-label={t('editCard')} onClick={() => setEditing(true)}>
            ✎
          </button>
          <button type="button" className={styles.iconButton} aria-label={t('deleteCard')} onClick={() => setConfirming(true)}>
            ×
          </button>
        </span>
      </div>
      <b>
        {new Intl.NumberFormat(locale).format(card.amount)} {amountLabel}
      </b>
      {card.company === '' ? null : <small>{card.company}</small>}
      <CardMarks card={card} locale={locale} stageColors={stageColors} stageIndex={stageIndex} />
      <div className={styles.cardActions}>
        <button type="button" className={styles.add} disabled={index === 0} onClick={() => onSave({ position: index - 1 })}>
          {t('earlier')}
        </button>
        <button type="button" className={styles.add} disabled={index >= total - 1} onClick={() => onSave({ position: index + 1 })}>
          {t('later')}
        </button>
      </div>
      <CardStatus card={card} statuses={statuses} onSave={onSave} />
      {confirming ? (
        <div className={styles.confirm}>
          <p>{t('confirmDelete')}</p>
          <button type="button" className={styles.danger} onClick={onDelete}>{t('deleteCard')}</button>
          <button type="button" className={styles.add} onClick={() => setConfirming(false)}>{t('cancel')}</button>
        </div>
      ) : null}
      {editing ? (
        <CardEditor
          card={card}
          kind={kind}
          userId={userId}
          statuses={statuses}
          onSave={onSave}
          onConvert={onConvert}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </article>
  );
}

function CardStatus({
  card,
  statuses,
  onSave,
}: {
  card: PipelineCard;
  statuses: PipelineBoard['statuses'];
  onSave: (patch: CardUpdate) => void;
}) {
  const t = useTranslations('pipeline');
  if (statuses.length === 0) {
    return null;
  }
  const current = statuses.find((item) => item.id === card.statusId);
  const color = current?.color;
  return (
    <div className={styles.statusCorner}>
      <select
        aria-label={t('status')}
        value={card.statusId ?? ''}
        style={color === undefined ? undefined : { background: color, color: textOn(color) }}
        onChange={(event) => onSave({ statusId: event.currentTarget.value === '' ? null : event.currentTarget.value })}
      >
        <option value="">{t('noStatus')}</option>
        {statuses.map((status) => (
          <option key={status.id} value={status.id}>{status.name}</option>
        ))}
      </select>
    </div>
  );
}

function CardMarks({
  card,
  locale,
  stageColors,
  stageIndex,
}: {
  card: PipelineCard;
  locale: string;
  stageColors: string[];
  stageIndex: number;
}) {
  return (
    <>
      {card.createdAt === null ? null : (
        <time className={styles.when} dateTime={card.createdAt}>{formatWhen(card.createdAt, locale)}</time>
      )}
      <div className={styles.stages} aria-hidden="true">
        {stageColors.map((color, index) => (
          <span key={color + String(index)} className={styles.stage} style={{ background: index <= stageIndex ? color : '#e7eaf0' }} />
        ))}
      </div>
    </>
  );
}

function CardEditor({
  card,
  kind,
  userId,
  statuses,
  onSave,
  onConvert,
  onClose,
}: {
  card: PipelineCard;
  kind: PipelineKindName;
  userId: string | null;
  statuses: PipelineBoard['statuses'];
  onSave: (patch: CardUpdate) => void;
  onConvert: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('pipeline');
  const contacts = useContacts();
  return (
    <div className={styles.dialog} role="presentation" onClick={onClose}>
      <form
        className={styles.dialogForm}
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => submitCard(event, onSave, onClose)}
      >
        <input name="title" aria-label={t('cardTitle')} defaultValue={card.title} required />
        <input name="company" aria-label={t('company')} defaultValue={card.company} />
        <input name="amount" aria-label={t('amount')} defaultValue={card.amount} inputMode="numeric" />
        <input name="source" aria-label={t('source')} defaultValue={card.source} placeholder={t('source')} />
        <input name="qualification" aria-label={t('qualification')} defaultValue={card.qualification} placeholder={t('qualification')} />
        <input name="nextAction" aria-label={t('nextAction')} defaultValue={card.nextAction} placeholder={t('nextAction')} />
        <input name="lostReason" aria-label={t('lostReason')} defaultValue={card.lostReason} placeholder={t('lostReason')} />
        <select name="outcome" aria-label={t('outcome')} defaultValue={card.outcome}>
          {OUTCOMES.map((outcome) => (
            <option key={outcome} value={outcome}>{t(outcomeLabel(outcome))}</option>
          ))}
        </select>
        <input name="expectedCloseOn" aria-label={t('expectedClose')} type="date" defaultValue={card.expectedCloseOn ?? ''} />
        <select name="contactId" aria-label={t('contact')} defaultValue={card.contactId ?? ''}>
          <option value="">{t('noContact')}</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>{contact.name}</option>
          ))}
        </select>
        <select name="statusId" aria-label={t('status')} defaultValue={card.statusId ?? ''}>
          <option value="">{t('noStatus')}</option>
          {statuses.map((status) => (
            <option key={status.id} value={status.id}>{status.name}</option>
          ))}
        </select>
        <select name="ownerUserId" aria-label={t('owner')} defaultValue={card.ownerUserId ?? ''}>
          <option value="">{t('clearOwner')}</option>
          {userId === null ? null : <option value={userId}>{t('assignToMe')}</option>}
        </select>
        <button type="submit" className={styles.add}>{t('save')}</button>
        {kind === 'lead' && card.outcome !== 'CONVERTED' ? (
          <button type="button" className={styles.add} onClick={onConvert}>{t('convert')}</button>
        ) : null}
        <button type="button" className={styles.add} onClick={onClose}>{t('cancel')}</button>
      </form>
    </div>
  );
}

function useContacts(): Contact[] {
  const [contacts, setContacts] = useState<Contact[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    listContacts('limit=50&sort=asc', controller.signal)
      .then((page) => setContacts(page.data))
      .catch(() => setContacts([]));
    return () => controller.abort();
  }, []);
  return contacts;
}

function submitCard(event: FormEvent<HTMLFormElement>, onSave: (patch: CardUpdate) => void, onClose: () => void): void {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const title = String(data.get('title') ?? '').trim();
  if (title === '') {
    return;
  }
  const expected = String(data.get('expectedCloseOn') ?? '');
  const contactId = String(data.get('contactId') ?? '');
  const ownerUserId = String(data.get('ownerUserId') ?? '');
  const statusId = String(data.get('statusId') ?? '');
  onSave({
    title,
    company: String(data.get('company') ?? '').trim(),
    amount: Math.max(0, Math.round(Number(data.get('amount') ?? 0) || 0)),
    source: String(data.get('source') ?? '').trim(),
    qualification: String(data.get('qualification') ?? '').trim(),
    nextAction: String(data.get('nextAction') ?? '').trim(),
    lostReason: String(data.get('lostReason') ?? '').trim(),
    outcome: outcomeValue(String(data.get('outcome') ?? 'OPEN')),
    expectedCloseOn: expected === '' ? null : expected,
    contactId: contactId === '' ? null : contactId,
    ownerUserId: ownerUserId === '' ? null : ownerUserId,
    statusId: statusId === '' ? null : statusId,
  });
  onClose();
}

function outcomeValue(value: string): PipelineCard['outcome'] {
  return OUTCOMES.find((outcome) => outcome === value) ?? 'OPEN';
}

function textOn(color: string): string {
  const hex = color.replace('#', '');
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? '#1f2937' : '#fff';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((part) => part !== '');
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
}

function formatWhen(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function outcomeLabel(outcome: PipelineCard['outcome']): 'outcomeOpen' | 'outcomeWon' | 'outcomeLost' | 'outcomeDisqualified' | 'outcomeConverted' {
  if (outcome === 'WON') return 'outcomeWon';
  if (outcome === 'LOST') return 'outcomeLost';
  if (outcome === 'DISQUALIFIED') return 'outcomeDisqualified';
  if (outcome === 'CONVERTED') return 'outcomeConverted';
  return 'outcomeOpen';
}
