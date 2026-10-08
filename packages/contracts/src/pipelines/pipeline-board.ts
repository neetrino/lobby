import { z } from 'zod';

/** Largest amount a pipeline card stores while the column is a PostgreSQL integer. */
export const PIPELINE_AMOUNT_MAX = 2_147_483_647;

export const pipelineKinds = ['lead', 'deal'] as const;

export const pipelineKindSchema = z.enum(pipelineKinds);

export const pipelineCardOutcomes = ['OPEN', 'WON', 'LOST', 'DISQUALIFIED', 'CONVERTED'] as const;

export const pipelineCardPriorities = ['NORMAL', 'URGENT'] as const;

const pipelineStatusSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  position: z.number().int().min(0),
});

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
  priority: z.enum(pipelineCardPriorities).default('NORMAL'),
  expectedCloseOn: z.iso.date().nullable().default(null),
  contactId: z.uuid().nullable().default(null),
  ownerUserId: z.uuid().nullable().default(null),
  statusId: z.uuid().nullable().default(null),
  createdAt: z.iso.datetime().nullable().default(null),
  createdByName: z.string().max(120).nullable().default(null),
  messageCount: z.number().int().min(0).default(0),
  noteCount: z.number().int().min(0).default(0),
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
  statuses: z.array(pipelineStatusSchema).default([]),
});

export const pipelineBoardResponseSchema = z.strictObject({
  data: pipelineBoardSchema,
});

export type PipelineKindName = z.infer<typeof pipelineKindSchema>;
export type PipelineBoard = z.infer<typeof pipelineBoardSchema>;
