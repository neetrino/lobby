import { z } from 'zod';

/** Single DNS label. Stored lowercase so subdomain uniqueness is case-insensitive. */
const subdomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/);

const requiredName = z.string().trim().min(1);

export const createTenantSchema = z.object({
  name: requiredName,
  subdomain: subdomainSchema,
  plan: requiredName,
  user: z.object({
    name: requiredName,
    email: z.string().trim().toLowerCase().pipe(z.email()),
  }),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
