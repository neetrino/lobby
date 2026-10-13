import type { useTranslations } from 'next-intl';

import type { AuditActor } from './audit-api';

type AuditText = ReturnType<typeof useTranslations<'audit'>>;

/** Turns a stored audit code into the sentence a workspace member should read. */
export function actionText(t: AuditText, action: string): string {
  switch (action) {
    case 'user.sessions.terminated':
      return t('actions.sessionsEnded');
    case 'invitation.created':
      return t('actions.invitationSent');
    case 'invitation.resent':
      return t('actions.invitationResent');
    case 'invitation.revoked':
      return t('actions.invitationCancelled');
    case 'invitation.accepted':
      return t('actions.invitationAccepted');
    case 'user.role.changed':
      return t('actions.roleChanged');
    case 'user.disabled':
      return t('actions.accessTurnedOff');
    case 'user.password.reset':
      return t('actions.passwordChanged');
    case 'contact.deleted':
      return t('actions.contactDeleted');
    case 'contact.archived':
      return t('actions.contactArchived');
    case 'contact.restored':
      return t('actions.contactRestored');
    case 'deal.stage.changed':
      return t('actions.dealMoved');
    case 'lead.stage.changed':
      return t('actions.leadMoved');
    case 'lead.converted':
      return t('actions.leadConverted');
    case 'pipeline.configured':
      return t('actions.boardUpdated');
    case 'pipeline.card.deleted':
      return t('actions.cardRemoved');
    case 'pipeline.card.updated':
      return t('actions.cardUpdated');
    case 'reservation.created':
      return t('actions.reservationCreated');
    case 'reservation.updated':
      return t('actions.reservationUpdated');
    case 'reservation.status.changed':
      return t('actions.reservationStatusChanged');
    default:
      return t('actions.recorded');
  }
}

/** Friendly name for a stored resource type. */
export function resourceText(t: AuditText, type: string): string {
  switch (type) {
    case 'user':
      return t('resources.user');
    case 'memberInvitation':
      return t('resources.invitation');
    case 'contact':
      return t('resources.contact');
    case 'deal':
      return t('resources.deal');
    case 'lead':
      return t('resources.lead');
    case 'pipeline':
      return t('resources.board');
    case 'reservation':
      return t('resources.reservation');
    default:
      return t('resources.record');
  }
}

/** Outcome a person can understand. The stored code stays in the API. */
export function outcomeText(t: AuditText, outcome: string): string {
  switch (outcome) {
    case 'SUCCESS':
      return t('outcomes.completed');
    case 'DENIED':
      return t('outcomes.blocked');
    case 'FAILURE':
      return t('outcomes.failed');
    default:
      return t('outcomes.recorded');
  }
}

/** Member role, or the integration label when no person did the action. */
export function roleText(t: AuditText, actor: Pick<AuditActor, 'role' | 'type'>): string | null {
  if (actor.type === 'INTEGRATION') return t('integration');
  switch (actor.role) {
    case 'OWNER':
      return t('roles.owner');
    case 'ADMIN':
      return t('roles.admin');
    case 'MEMBER':
      return t('roles.member');
    default:
      return null;
  }
}

export type ChangeLine = { label: string; value: string };

/** Plain lines for a detail panel. Sensitive keys are already removed by the API. */
export function changeLines(t: AuditText, changes: unknown): ChangeLine[] {
  if (!isRecord(changes)) return [];
  return Object.entries(changes).flatMap(([key, value]) => {
    const text = changeValue(t, key, value);
    return text === null ? [] : [{ label: fieldLabel(t, key), value: text }];
  });
}

function fieldLabel(t: AuditText, key: string): string {
  switch (key) {
    case 'authenticationVersion':
      return t('fields.signInVersion');
    case 'provider':
      return t('fields.channel');
    case 'sourceAccountId':
      return t('fields.account');
    case 'status':
      return t('fields.status');
    case 'startsAt':
      return t('fields.startsAt');
    case 'guestCount':
      return t('fields.guestCount');
    case 'locationChanged':
      return t('fields.location');
    case 'tableChanged':
      return t('fields.table');
    case 'assigneeChanged':
      return t('fields.assignee');
    case 'contactChanged':
      return t('fields.contact');
    case 'guestDetailsChanged':
      return t('fields.guestDetails');
    default:
      return t('fields.detail');
  }
}

function changeValue(t: AuditText, key: string, value: unknown): string | null {
  if (value === true) return t('fields.updated');
  if (key === 'status' && isRecord(value)) {
    return `${statusText(t, value.from)} → ${statusText(t, value.to)}`;
  }
  if (key === 'startsAt' && isRecord(value)) {
    return `${clock(value.from)} → ${clock(value.to)}`;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (!isRecord(value)) return null;
  const from = plain(value.from);
  const to = plain(value.to);
  if (from === null && to === null) return null;
  return `${from ?? '—'} → ${to ?? '—'}`;
}

function statusText(t: AuditText, value: unknown): string {
  switch (value) {
    case 'PENDING':
      return t('statuses.PENDING');
    case 'CONFIRMED':
      return t('statuses.CONFIRMED');
    case 'ARRIVED':
      return t('statuses.ARRIVED');
    case 'SEATED':
      return t('statuses.SEATED');
    case 'COMPLETED':
      return t('statuses.COMPLETED');
    case 'CANCELLED':
      return t('statuses.CANCELLED');
    case 'NO_SHOW':
      return t('statuses.NO_SHOW');
    default:
      return '—';
  }
}

function clock(value: unknown): string {
  if (typeof value !== 'string') return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function plain(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
