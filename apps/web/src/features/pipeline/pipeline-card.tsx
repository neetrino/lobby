'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';

import { listContacts } from '../contacts/contacts-api';
import type { Contact } from '../contacts/contact';
import type { CardUpdate, PipelineCard, PipelineKindName } from './pipeline-api';
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
  onSave: (patch: CardUpdate) => void;
  onDelete: () => void;
  onConvert: () => void;
}) {
  const t = useTranslations('pipeline');
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  return (
    <article
      className={styles.card}
      draggable={!editing}
      onDragStart={(event) => event.dataTransfer.setData('text/plain', card.id)}
    >
      <div className={styles.cardTop}>
        <strong>{card.title}</strong>
        <button type="button" className={styles.iconButton} aria-label={t('editCard')} onClick={() => setEditing(true)}>
          ✎
        </button>
        <button type="button" className={styles.iconButton} aria-label={t('deleteCard')} onClick={() => setConfirming(true)}>
          ×
        </button>
      </div>
      <b>
        {new Intl.NumberFormat(locale).format(card.amount)} {amountLabel}
      </b>
      {card.company === '' ? null : <small>{card.company}</small>}
      <div className={styles.cardActions}>
        <button type="button" className={styles.add} disabled={index === 0} onClick={() => onSave({ position: index - 1 })}>
          {t('earlier')}
        </button>
        <button type="button" className={styles.add} disabled={index >= total - 1} onClick={() => onSave({ position: index + 1 })}>
          {t('later')}
        </button>
      </div>
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
          onSave={onSave}
          onConvert={onConvert}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </article>
  );
}

function CardEditor({
  card,
  kind,
  userId,
  onSave,
  onConvert,
  onClose,
}: {
  card: PipelineCard;
  kind: PipelineKindName;
  userId: string | null;
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
  });
  onClose();
}

function outcomeValue(value: string): PipelineCard['outcome'] {
  return OUTCOMES.find((outcome) => outcome === value) ?? 'OPEN';
}

function outcomeLabel(outcome: PipelineCard['outcome']): 'outcomeOpen' | 'outcomeWon' | 'outcomeLost' | 'outcomeDisqualified' | 'outcomeConverted' {
  if (outcome === 'WON') return 'outcomeWon';
  if (outcome === 'LOST') return 'outcomeLost';
  if (outcome === 'DISQUALIFIED') return 'outcomeDisqualified';
  if (outcome === 'CONVERTED') return 'outcomeConverted';
  return 'outcomeOpen';
}
