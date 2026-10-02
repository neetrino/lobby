import { z } from 'zod';

export const supportedLocales = ['hy', 'ru', 'en'] as const;
export const defaultLocale = 'en' as const;
export const localeSchema = z.enum(supportedLocales);

export type Locale = z.infer<typeof localeSchema>;
