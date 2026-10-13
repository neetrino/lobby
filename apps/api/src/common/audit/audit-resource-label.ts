import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import type { TenantId } from '../tenant/tenant-id';

type Source = { resourceType: string; resourceId: string };

/** Display labels for resources that still exist. A deleted row stays unlabeled. No foreign keys. */
export async function resourceLabels(
  db: PrismaClient,
  tenantId: TenantId,
  rows: readonly Source[],
): Promise<ReadonlyMap<string, string>> {
  const labels = new Map<string, string>();
  await Promise.all([
    labelUsers(db, tenantId, ids(rows, 'user'), labels),
    labelContacts(db, tenantId, ids(rows, 'contact'), labels),
    labelReservations(db, tenantId, ids(rows, 'reservation'), labels),
    labelCards(db, tenantId, [...ids(rows, 'lead'), ...ids(rows, 'deal')], labels),
    labelPipelines(db, tenantId, ids(rows, 'pipeline'), labels),
  ]);
  return labels;
}

export function resourceKey(type: string, id: string): string {
  return `${type}:${id}`;
}

function ids(rows: readonly Source[], type: string): string[] {
  return [...new Set(rows.filter((row) => row.resourceType === type).map((row) => row.resourceId))];
}

async function labelUsers(
  db: PrismaClient,
  tenantId: TenantId,
  userIds: string[],
  labels: Map<string, string>,
): Promise<void> {
  if (userIds.length === 0) return;
  const users = await db.user.findMany({
    where: { tenantId, id: { in: userIds } },
    select: { id: true, name: true },
  });
  for (const user of users) labels.set(resourceKey('user', user.id), user.name);
}

async function labelContacts(
  db: PrismaClient,
  tenantId: TenantId,
  contactIds: string[],
  labels: Map<string, string>,
): Promise<void> {
  if (contactIds.length === 0) return;
  const contacts = await db.contact.findMany({
    where: { tenantId, id: { in: contactIds } },
    select: { id: true, name: true },
  });
  for (const contact of contacts) labels.set(resourceKey('contact', contact.id), contact.name);
}

async function labelReservations(
  db: PrismaClient,
  tenantId: TenantId,
  reservationIds: string[],
  labels: Map<string, string>,
): Promise<void> {
  if (reservationIds.length === 0) return;
  const bookings = await db.reservation.findMany({
    where: { tenantId, id: { in: reservationIds } },
    select: { id: true, customerName: true, startsAt: true },
  });
  for (const booking of bookings) {
    labels.set(resourceKey('reservation', booking.id), reservationLabel(booking));
  }
}

async function labelCards(
  db: PrismaClient,
  tenantId: TenantId,
  cardIds: string[],
  labels: Map<string, string>,
): Promise<void> {
  if (cardIds.length === 0) return;
  const cards = await db.pipelineCard.findMany({
    where: { tenantId, id: { in: cardIds } },
    select: { id: true, title: true },
  });
  for (const card of cards) {
    labels.set(resourceKey('lead', card.id), card.title);
    labels.set(resourceKey('deal', card.id), card.title);
  }
}

async function labelPipelines(
  db: PrismaClient,
  tenantId: TenantId,
  pipelineIds: string[],
  labels: Map<string, string>,
): Promise<void> {
  if (pipelineIds.length === 0) return;
  const pipelines = await db.pipeline.findMany({
    where: { tenantId, id: { in: pipelineIds } },
    select: { id: true, name: true },
  });
  for (const pipeline of pipelines) labels.set(resourceKey('pipeline', pipeline.id), pipeline.name);
}

function reservationLabel(booking: { customerName: string; startsAt: Date }): string {
  const when = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).format(booking.startsAt);
  return `${booking.customerName} · ${when}`;
}
