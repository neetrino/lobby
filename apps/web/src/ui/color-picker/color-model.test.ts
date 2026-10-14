import { describe, expect, it } from 'vitest';

import { hexToRgb, hsvToRgb, normalizeHex, rgbToHex, rgbToHsv } from './color-model';

describe('color model', () => {
  it('normalizes a hex color and falls back when the text is not one', () => {
    expect(normalizeHex('2563EB')).toBe('#2563eb');
    expect(normalizeHex('nope')).toBe('#2563eb');
  });

  it('round-trips primary colors through hsv', () => {
    for (const hex of ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#2563eb']) {
      expect(rgbToHex(hsvToRgb(rgbToHsv(hexToRgb(hex))))).toBe(hex);
    }
  });
});
