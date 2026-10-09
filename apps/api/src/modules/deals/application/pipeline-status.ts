import { NotFoundException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import type { TenantId } from '../../../common/tenant/tenant-id';
import { rethrowWrite } from './pipeline-positions';
import type { StatusCreate, StatusPatch } from './pipeline.schema';

type Tx = Prisma.TransactionClient;

/** Rejects a status that belongs to another tenant. Null clears the card. */
export async function requireStatus(
  tx: Tx,
  tenantId: TenantId,
  statusId: string | null | undefined,
): Promise<void> {
  if (!statusId) {
    return;
  }
  const status = await tx.pipelineStatus.findFirst({
    where: { id: statusId, tenantId },
    select: { id: true },
  });
  if (status === null) {
    throw new NotFoundException();
  }
}

export async function listStatuses(prisma: PrismaClient, tenantId: TenantId) {
  return prisma.pipelineStatus.findMany({
    where: { tenantId },
    orderBy: { position: 'asc' },
    select: { id: true, name: true, color: true, position: true },
  });
}

export async function createStatus(
  prisma: PrismaClient,
  tenantId: TenantId,
  input: StatusCreate,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const last = await tx.pipelineStatus.aggregate({
      where: { tenantId },
      _max: { position: true },
    });
    const position = (last._max.position ?? -1) + 1;
    await tx.pipelineStatus.create({
      data: { tenantId, name: input.name, color: input.color, position },
    }).catch(rethrowWrite);
  });
}

export async function updateStatus(
  prisma: PrismaClient,
  tenantId: TenantId,
  statusId: string,
  patch: StatusPatch,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await requireStatus(tx, tenantId, statusId);
    await tx.pipelineStatus.update({
      where: { id: statusId },
      data: { name: patch.name, color: patch.color },
    }).catch(rethrowWrite);
  });
}

/** Removes the label and clears it from cards in the same transaction. */
export async function deleteStatus(
  prisma: PrismaClient,
  tenantId: TenantId,
  statusId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await requireStatus(tx, tenantId, statusId);
    await tx.pipelineCard.updateMany({
      where: { tenantId, statusId },
      data: { statusId: null },
    });
    await tx.pipelineStatus.delete({ where: { id: statusId } }).catch(rethrowWrite);
  });
}
