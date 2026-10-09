export const pipelineKinds = ['lead', 'deal'] as const;

export type PipelineKindName = (typeof pipelineKinds)[number];

const MIN_WIDTH = 220;
const MAX_WIDTH = 640;

const DEFAULTS = {
  lead: {
    en: { name: 'Leads', columns: ['New', 'Contacted', 'Qualified'] },
    hy: { name: 'Լիդեր', columns: ['Նոր', 'Կապ', 'Որակավորված'] },
    ru: { name: 'Лиды', columns: ['Новые', 'Контакт', 'Квалифицированы'] },
  },
  deal: {
    en: { name: 'Deals', columns: ['New', 'Qualified', 'Proposal', 'Negotiation', 'Won'] },
    hy: { name: 'Գործարքներ', columns: ['Նոր', 'Որակավորված', 'Առաջարկ', 'Բանակցություն', 'Հաղթած'] },
    ru: { name: 'Сделки', columns: ['Новые', 'Квалифицированы', 'Предложение', 'Переговоры', 'Выиграны'] },
  },
} as const;

/** English, Armenian, and Russian names used when the deals module is granted. Later names are the tenant's. */
export function defaultPipeline(
  kind: PipelineKindName,
  locale: string,
): { name: string; columns: readonly string[] } {
  const language = locale === 'hy' || locale === 'ru' ? locale : 'en';
  return DEFAULTS[kind][language];
}

/** Column width the board is allowed to store. */
export function clampColumnWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
}
