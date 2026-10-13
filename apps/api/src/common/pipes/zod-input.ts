import { Body, Param, Query } from '@nestjs/common';
import type { ZodType } from 'zod';

import { ZodValidationPipe } from './zod-validation.pipe';

/**
 * Binds a Zod schema to the JSON body.
 * A failure becomes `400 VALIDATION_ERROR` with field paths and no submitted values.
 */
export const ZodBody = (schema: ZodType) => Body(new ZodValidationPipe(schema));

/** Binds a Zod schema to the query string. */
export const ZodQuery = (schema: ZodType) => Query(new ZodValidationPipe(schema));

/** Binds a Zod schema to one route parameter. */
export const ZodParam = (name: string, schema: ZodType) =>
  Param(name, new ZodValidationPipe(schema));
