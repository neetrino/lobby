import { z } from 'zod';

import {
  contactEmailSchema,
  contactNameSchema,
  contactPhoneSchema,
  contactTypeSchema,
} from './contact-fields';

/** Patch body. At least one field is required. A client tenant id is rejected. */
export const updateContactSchema = z
  .strictObject({
    name: contactNameSchema.optional(),
    type: contactTypeSchema.optional(),
    email: contactEmailSchema,
    phone: contactPhoneSchema,
  })
  .refine((input) => Object.values(input).some((field) => field !== undefined), {
    message: 'At least one field is required',
  });

export type UpdateContactInput = z.infer<typeof updateContactSchema>;

/** Existing rename callers use the same patch schema. */
export const renameContactSchema = updateContactSchema;

export type RenameContactInput = UpdateContactInput;
