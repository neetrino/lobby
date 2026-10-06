import {
  createTestPrismaClient,
  disposeTestPrismaClient,
  type PrismaClient,
} from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
});

afterAll(async () => {
  await disposeTestPrismaClient(prisma);
});

beforeEach(async () => {
  await prisma.pipelineCard.deleteMany();
  await prisma.pipelineColumn.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('pipeline database invariants', () => {
  it('rejects a card whose column belongs to the other board', async () => {
    const tenant = await tenantWithBoards();
    const leadColumn = tenant.lead.columns[0];
    if (leadColumn === undefined) {
      throw new Error('Lead column was not created.');
    }

    await expect(
      prisma.pipelineCard.create({
        data: {
          tenantId: tenant.id,
          pipelineId: tenant.deal.id,
          columnId: leadColumn.id,
          title: 'Crossed',
          position: 0,
        },
      }),
    ).rejects.toThrow();
    expect(await prisma.pipelineCard.count()).toBe(0);
  });

  it('rejects two cards in the same column position', async () => {
    const tenant = await tenantWithBoards();
    const column = tenant.deal.columns[0];
    if (column === undefined) {
      throw new Error('Deal column was not created.');
    }
    await prisma.pipelineCard.create({
      data: {
        tenantId: tenant.id,
        pipelineId: tenant.deal.id,
        columnId: column.id,
        title: 'First',
        position: 0,
      },
    });

    await expect(
      prisma.pipelineCard.create({
        data: {
          tenantId: tenant.id,
          pipelineId: tenant.deal.id,
          columnId: column.id,
          title: 'Second',
          position: 0,
        },
      }),
    ).rejects.toThrow();
    expect(await prisma.pipelineCard.count()).toBe(1);
  });
});

async function tenantWithBoards(): Promise<{
  id: string;
  lead: { id: string; columns: Array<{ id: string }> };
  deal: { id: string; columns: Array<{ id: string }> };
}> {
  const tenant = await prisma.tenant.create({
    data: { name: 'Acme', subdomain: 'pipe-invariant', plan: 'STARTER' },
  });
  const lead = await board(tenant.id, 'LEAD', 'Leads');
  const deal = await board(tenant.id, 'DEAL', 'Deals');
  return { id: tenant.id, lead, deal };
}

function board(tenantId: string, kind: 'LEAD' | 'DEAL', name: string) {
  return prisma.pipeline.create({
    data: {
      tenantId,
      kind,
      name,
      columns: { create: [{ name: 'New', position: 0, widthPx: 300 }] },
    },
    select: { id: true, columns: { select: { id: true } } },
  });
}
