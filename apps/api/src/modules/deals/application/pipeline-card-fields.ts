import type { CardCreate, CardPatch } from './pipeline.schema';
import type { TenantId } from '../../../common/tenant/tenant-id';

type StoredCard = {
  id: string;
  title: string;
  company: string;
  amount: number;
  position: number;
  source: string;
  qualification: string;
  nextAction: string;
  lostReason: string;
  outcome: 'OPEN' | 'WON' | 'LOST' | 'DISQUALIFIED' | 'CONVERTED';
  expectedCloseOn: Date | null;
  contactId: string | null;
  ownerUserId: string | null;
  statusId: string | null;
  createdAt: Date;
  createdBy?: { name: string } | null;
  _count?: { messages: number; notes: number };
};

/** Serializes a stored card for the board response. Dates stay calendar days. */
export function presentCard(card: StoredCard) {
  return {
    id: card.id,
    title: card.title,
    company: card.company,
    amount: card.amount,
    position: card.position,
    source: card.source,
    qualification: card.qualification,
    nextAction: card.nextAction,
    lostReason: card.lostReason,
    outcome: card.outcome,
    expectedCloseOn: card.expectedCloseOn === null ? null : card.expectedCloseOn.toISOString().slice(0, 10),
    contactId: card.contactId,
    ownerUserId: card.ownerUserId,
    statusId: card.statusId,
    createdAt: card.createdAt.toISOString(),
    createdByName: card.createdBy?.name ?? null,
    messageCount: card._count?.messages ?? 0,
    noteCount: card._count?.notes ?? 0,
  };
}

function closeDay(value: string | null): Date | null {
  return value === null ? null : new Date(`${value}T00:00:00.000Z`);
}

export function cardInsert(
  tenantId: TenantId,
  pipelineId: string,
  input: CardCreate,
  position: number,
  createdByUserId: string,
) {
  return {
    tenantId,
    pipelineId,
    columnId: input.columnId,
    title: input.title,
    company: input.company,
    amount: input.amount,
    position,
    source: input.source,
    qualification: input.qualification,
    nextAction: input.nextAction,
    lostReason: input.lostReason,
    outcome: input.outcome,
    expectedCloseOn: closeDay(input.expectedCloseOn),
    contactId: input.contactId,
    ownerUserId: input.ownerUserId,
    statusId: input.statusId,
    createdByUserId,
  };
}

export function cardChanges(
  patch: CardPatch,
  moved: boolean,
  columnId: string | undefined,
  position: number | undefined,
) {
  return {
    title: patch.title,
    company: patch.company,
    amount: patch.amount,
    source: patch.source,
    qualification: patch.qualification,
    nextAction: patch.nextAction,
    lostReason: patch.lostReason,
    outcome: patch.outcome,
    contactId: patch.contactId,
    ownerUserId: patch.ownerUserId,
    statusId: patch.statusId,
    ...(patch.expectedCloseOn !== undefined ? { expectedCloseOn: closeDay(patch.expectedCloseOn) } : {}),
    ...(moved ? { columnId, position } : {}),
  };
}

export function copiedDeal(
  tenantId: TenantId,
  pipelineId: string,
  columnId: string,
  position: number,
  source: StoredCard,
  createdByUserId: string,
) {
  return {
    tenantId,
    pipelineId,
    columnId,
    position,
    title: source.title,
    company: source.company,
    amount: source.amount,
    source: source.source,
    qualification: source.qualification,
    nextAction: source.nextAction,
    lostReason: '',
    outcome: 'OPEN' as const,
    expectedCloseOn: source.expectedCloseOn,
    contactId: source.contactId,
    ownerUserId: source.ownerUserId,
    statusId: source.statusId,
    createdByUserId,
  };
}
