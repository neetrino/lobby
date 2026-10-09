import type { Prisma, PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import type { TenantId } from '../../../common/tenant/tenant-id';
import type { SourceIdentity, StoredSourceRequest } from './reservation.repository';

type ReservationDb = PrismaClient | Prisma.TransactionClient;

export const reservationSelect = {
  id: true,
  locationId: true,
  tableId: true,
  contactId: true,
  assignedUserId: true,
  source: true,
  guestCount: true,
  startsAt: true,
  endsAt: true,
  customerName: true,
  customerPhone: true,
  customerEmail: true,
  customerNote: true,
  sourceAccountId: true,
  sourceRequestId: true,
  sourceConversationId: true,
  sourceMessageId: true,
  status: true,
  confirmedAt: true,
  arrivedAt: true,
  seatedAt: true,
  completedAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function findStoredSourceRequest(
  db: ReservationDb,
  tenantId: TenantId,
  source: SourceIdentity,
): Promise<StoredSourceRequest | null> {
  const row = await db.reservationSourceRequest.findFirst({
    where: {
      tenantId,
      source: source.source,
      sourceAccountId: source.sourceAccountId,
      externalRequestId: source.externalRequestId,
    },
    select: { requestFingerprint: true, reservation: { select: reservationSelect } },
  });
  if (row === null) {
    return null;
  }
  return { requestFingerprint: row.requestFingerprint, reservation: row.reservation };
}

/** Serializes identical source retries until the current transaction ends. */
export async function lockStoredSourceRequest(
  db: ReservationDb,
  tenantId: TenantId,
  source: SourceIdentity,
): Promise<void> {
  const key = [tenantId, source.source, source.sourceAccountId, source.externalRequestId].join('\u001f');
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, ${0n}))`;
}

export async function insertStoredSourceRequest(
  db: ReservationDb,
  tenantId: TenantId,
  source: SourceIdentity,
  reservationId: string,
  requestFingerprint: string,
): Promise<void> {
  await db.reservationSourceRequest.create({
    data: { tenantId, reservationId, requestFingerprint, ...source },
  });
}
