import { z } from 'zod';

import { pipelineKinds } from './pipeline-defaults';

/** Largest value a PostgreSQL INTEGER column can store. */
export const PIPELINE_AMOUNT_MAX = 2_147_483_647;

const amountSchema = z.number().int().min(0).max(PIPELINE_AMOUNT_MAX);
const columnIdSchema = z.uuid();

export const pipelineKindSchema = z.enum(pipelineKinds);

export const pipelinePatchSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(80).optional(),
    amountLabel: z.string().trim().max(8).optional(),
  })
  .refine((value) => value.name !== undefined || value.amountLabel !== undefined);

export const columnCreateSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
});

export const columnPatchSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(80).optional(),
    widthPx: z.number().int().min(220).max(640).optional(),
  })
  .refine((value) => value.name !== undefined || value.widthPx !== undefined);

const outcomeSchema = z.enum(['OPEN', 'WON', 'LOST', 'DISQUALIFIED', 'CONVERTED']);
const statusColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/).transform((value) => value.toLowerCase());

export const cardCreateSchema = z.strictObject({
  columnId: columnIdSchema,
  title: z.string().trim().min(1).max(120),
  company: z.string().trim().max(120).default(''),
  amount: amountSchema.default(0),
  source: z.string().trim().max(120).default(''),
  qualification: z.string().trim().max(200).default(''),
  nextAction: z.string().trim().max(200).default(''),
  lostReason: z.string().trim().max(200).default(''),
  outcome: outcomeSchema.default('OPEN'),
  expectedCloseOn: z.iso.date().nullable().default(null),
  contactId: z.uuid().nullable().default(null),
  ownerUserId: z.uuid().nullable().default(null),
  statusId: z.uuid().nullable().default(null),
});

export const statusCreateSchema = z.strictObject({
  name: z.string().trim().min(1).max(40),
  color: statusColorSchema,
});

export const statusPatchSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(40).optional(),
    color: statusColorSchema.optional(),
  })
  .refine((value) => value.name !== undefined || value.color !== undefined);

export const cardPatchSchema = z
  .strictObject({
    columnId: columnIdSchema.optional(),
    title: z.string().trim().min(1).max(120).optional(),
    company: z.string().trim().max(120).optional(),
    amount: amountSchema.optional(),
    source: z.string().trim().max(120).optional(),
    qualification: z.string().trim().max(200).optional(),
    nextAction: z.string().trim().max(200).optional(),
    lostReason: z.string().trim().max(200).optional(),
    outcome: outcomeSchema.optional(),
    expectedCloseOn: z.iso.date().nullable().optional(),
    contactId: z.uuid().nullable().optional(),
    ownerUserId: z.uuid().nullable().optional(),
    statusId: z.uuid().nullable().optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined));

export type PipelinePatch = z.infer<typeof pipelinePatchSchema>;
export type ColumnCreate = z.infer<typeof columnCreateSchema>;
export type ColumnPatch = z.infer<typeof columnPatchSchema>;
export type CardCreate = z.infer<typeof cardCreateSchema>;
export type CardPatch = z.infer<typeof cardPatchSchema>;
export type StatusCreate = z.infer<typeof statusCreateSchema>;
export type StatusPatch = z.infer<typeof statusPatchSchema>;
