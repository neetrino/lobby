import { z } from 'zod';

/** High-priority MVP capabilities from the product brief. */
export const moduleKeys = ['contacts', 'tasks', 'deals', 'reservations'] as const;

export const moduleKeySchema = z.enum(moduleKeys);

export type ModuleKey = z.infer<typeof moduleKeySchema>;
