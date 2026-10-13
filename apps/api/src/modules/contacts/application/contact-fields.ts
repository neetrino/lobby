import { z } from 'zod';

export const contactNameSchema = z.string().trim().min(1).max(200);

export const contactTypeSchema = z.enum(['person', 'organization']);

export type PublicContactType = z.infer<typeof contactTypeSchema>;

export const contactEmailSchema = z
  .string()
  .trim()
  .max(254)
  .toLowerCase()
  .pipe(z.email())
  .nullable()
  .optional();

export const contactPhoneSchema = z.string().trim().min(1).max(32).nullable().optional();

export function toStoredContactType(type: PublicContactType): 'PERSON' | 'ORGANIZATION' {
  return type === 'organization' ? 'ORGANIZATION' : 'PERSON';
}

export function toPublicContactType(type: 'PERSON' | 'ORGANIZATION'): PublicContactType {
  return type === 'ORGANIZATION' ? 'organization' : 'person';
}
