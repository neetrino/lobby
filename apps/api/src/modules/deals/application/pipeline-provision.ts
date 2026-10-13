import type { Prisma } from '@lobby/database' with { 'resolution-mode': 'import' };

import { defaultPipeline, type PipelineKindName } from './pipeline-defaults';
import { storedKind } from './pipeline-positions';

/**
 * Creates the lead and deal boards once, inside the caller's transaction.
 * Used when the deals module is granted. A repeated call leaves an existing board unchanged.
 * Default names are English. The tenant renames them later.
 */
export async function provisionDefaultPipelines(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<void> {
  for (const kind of ['lead', 'deal'] as const satisfies readonly PipelineKindName[]) {
    await provisionOne(tx, tenantId, kind);
  }
}

async function provisionOne(
  tx: Prisma.TransactionClient,
  tenantId: string,
  kind: PipelineKindName,
): Promise<void> {
  const stored = storedKind(kind);
  const existing = await tx.pipeline.findUnique({
    where: { tenantId_kind: { tenantId, kind: stored } },
  });
  if (existing !== null) {
    return;
  }
  const defaults = defaultPipeline(kind, 'en');
  await tx.pipeline.create({
    data: {
      tenantId,
      kind: stored,
      name: defaults.name,
      columns: {
        create: defaults.columns.map((name, position) => ({ name, position, widthPx: 300 })),
      },
    },
  });
}
