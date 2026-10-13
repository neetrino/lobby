import { z } from 'zod';

/**
 * Optional product modules that already have a module directory.
 * Identity and health stay available for every tenant and are not listed here.
 */
export const moduleKeys = ['contacts', 'deals', 'reservations', 'messenger'] as const;

export const moduleKeySchema = z.enum(moduleKeys);

export type ModuleKey = z.infer<typeof moduleKeySchema>;
