import { z } from 'zod';

/** Largest amount a pipeline card stores while the column is a PostgreSQL integer. */
export const PIPELINE_AMOUNT_MAX = 2_147_483_647;

export const pipelineKinds = ['lead', 'deal'] as const;

export const pipelineKindSchema = z.enum(pipelineKinds);

export const pipelineCardOutcomes = ['OPEN', 'WON', 'LOST', 'DISQUALIFIED', 'CONVERTED'] as const;

const pipelineCardSchema = z.strictObject({
  id: z.uuid(),
  title: z.string().min(1).max(120),
  company: z.string().max(120),
  amount: z.number().int().min(0).max(PIPELINE_AMOUNT_MAX),
  position: z.number().int().min(0),
  source: z.string().max(120).default(''),
  qualification: z.string().max(200).default(''),
  nextAction: z.string().max(200).default(''),
  lostReason: z.string().max(200).default(''),
  outcome: z.enum(pipelineCardOutcomes).default('OPEN'),
  expectedCloseOn: z.iso.date().nullable().default(null),
  contactId: z.uuid().nullable().default(null),
  ownerUserId: z.uuid().nullable().default(null),
});

const pipelineColumnSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1).max(80),
  position: z.number().int().min(0),
  widthPx: z.number().int().min(220).max(640),
  cards: z.array(pipelineCardSchema),
});

/** Board returned by the pipeline routes. */
export const pipelineBoardSchema = z.strictObject({
  id: z.uuid(),
  kind: pipelineKindSchema,
  name: z.string().min(1).max(80),
  amountLabel: z.string().max(8),
  columns: z.array(pipelineColumnSchema),
});

export const pipelineBoardResponseSchema = z.strictObject({
  data: pipelineBoardSchema,
});

export type PipelineKindName = z.infer<typeof pipelineKindSchema>;
export type PipelineBoard = z.infer<typeof pipelineBoardSchema>;
