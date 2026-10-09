import type { Prisma } from '@lobby/database' with { 'resolution-mode': 'import' };

/** Holds the pipeline row until the surrounding transaction commits. */
export async function lockPipeline(db: Prisma.TransactionClient, pipelineId: string): Promise<void> {
  await db.$queryRaw`SELECT id FROM "pipelines" WHERE id = ${pipelineId}::uuid FOR UPDATE`;
}

/** Holds one card row until the surrounding transaction commits. */
export async function lockCard(db: Prisma.TransactionClient, cardId: string): Promise<void> {
  await db.$queryRaw`SELECT id FROM "pipeline_cards" WHERE id = ${cardId}::uuid FOR UPDATE`;
}

/** Holds one column row until the surrounding transaction commits. */
export async function lockColumn(db: Prisma.TransactionClient, columnId: string): Promise<void> {
  await db.$queryRaw`SELECT id FROM "pipeline_columns" WHERE id = ${columnId}::uuid FOR UPDATE`;
}
