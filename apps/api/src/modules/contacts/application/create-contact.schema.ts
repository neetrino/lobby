import { z } from 'zod';

import {
  contactEmailSchema,
  contactNameSchema,
  contactPhoneSchema,
  contactTypeSchema,
} from './contact-fields';

/** Create body. The tenant, owner, and creator come from the session, never the client. */
export const createContactSchema = z.strictObject({
  name: contactNameSchema,
  type: contactTypeSchema.default('person'),
  email: contactEmailSchema,
  phone: contactPhoneSchema,
});

export type CreateContactInput = z.input<typeof createContactSchema>;

export type CreateContactBody = z.output<typeof createContactSchema>;
