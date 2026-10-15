'use client';

import { useTranslations } from 'next-intl';
import type { FormEvent } from 'react';

import { useSheetDismiss } from '../../ui/overlay/sheet-dismiss';
import { SheetChrome, SheetFrame, sheetStyles } from '../../ui/side-sheet/side-sheet';
import { OverlayPortal } from '../contacts/overlay-portal';

type CardDraft = { title: string; company: string; amount: number };

/** Same right-hand sheet as editing a card, for the column's add action. */
export function NewCardSheet({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (draft: CardDraft) => void;
}) {
  const t = useTranslations('pipeline');
  return (
    <OverlayPortal onDismiss={onClose}>
      <SheetFrame label={t('addCard')} closeLabel={t('close')}>
        <NewCardForm onCreate={onCreate} />
      </SheetFrame>
    </OverlayPortal>
  );
}

function NewCardForm({ onCreate }: { onCreate: (draft: CardDraft) => void }) {
  const t = useTranslations('pipeline');
  const dismiss = useSheetDismiss(() => undefined);
  return (
    <SheetChrome
      as="form"
      title={t('addCard')}
      onSubmit={(event) => submitNewCard(event, onCreate, dismiss)}
      footer={
        <button type="submit" className={sheetStyles.save}>
          {t('save')}
        </button>
      }
    >
      <label>
        {t('cardTitle')}
        <input name="title" aria-label={t('cardTitle')} placeholder={t('cardTitle')} required />
      </label>
      <label>
        {t('company')}
        <input name="company" aria-label={t('company')} placeholder={t('company')} />
      </label>
      <label>
        {t('amount')}
        <input name="amount" aria-label={t('amount')} placeholder={t('amount')} inputMode="numeric" />
      </label>
    </SheetChrome>
  );
}

function submitNewCard(
  event: FormEvent<HTMLFormElement>,
  onCreate: (draft: CardDraft) => void,
  dismiss: () => void,
): void {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const title = String(data.get('title') ?? '').trim();
  if (title === '') {
    return;
  }
  onCreate({
    title,
    company: String(data.get('company') ?? '').trim(),
    amount: Math.max(0, Math.round(Number(data.get('amount') ?? 0) || 0)),
  });
  dismiss();
}
