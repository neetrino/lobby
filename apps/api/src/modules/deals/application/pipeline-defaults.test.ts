import { describe, expect, it } from 'vitest';

import { clampColumnWidth, defaultPipeline } from './pipeline-defaults';

describe('pipeline defaults', () => {
  it('gives a new tenant editable stage names and keeps later widths inside the limit', () => {
    expect(defaultPipeline('deal', 'hy').columns).toEqual([
      'Նոր',
      'Որակավորված',
      'Առաջարկ',
      'Բանակցություն',
      'Հաղթած',
    ]);
    expect(defaultPipeline('lead', 'fr').name).toBe('Leads');
    expect(clampColumnWidth(80)).toBe(220);
    expect(clampColumnWidth(900)).toBe(640);
    expect(clampColumnWidth(360.4)).toBe(360);
  });
});
