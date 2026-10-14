import { describe, expect, it } from 'vitest';

import { menuPlacement } from './anchored-menu';

const frame = {
  anchorLeft: 40,
  anchorWidth: 200,
  boundsTop: 16,
  boundsBottom: 600,
  viewportWidth: 800,
};

describe('menuPlacement', () => {
  it('opens downward when the list fits below the trigger', () => {
    const box = menuPlacement({
      ...frame,
      anchorTop: 100,
      anchorBottom: 142,
      menuHeight: 120,
    });
    expect(box.upward).toBe(false);
    expect(box.top).toBe(148);
  });

  it('opens upward when the list would pass the bottom edge', () => {
    const box = menuPlacement({
      ...frame,
      anchorTop: 520,
      anchorBottom: 562,
      menuHeight: 180,
    });
    expect(box.upward).toBe(true);
    expect(box.top).toBe(514);
    expect(box.maxHeight).toBeLessThanOrEqual(520 - 16 - 6);
  });

  it('stays on the larger side when the list fits on neither', () => {
    const below = menuPlacement({
      ...frame,
      anchorTop: 40,
      anchorBottom: 80,
      boundsTop: 0,
      boundsBottom: 200,
      menuHeight: 240,
    });
    expect(below.upward).toBe(false);
    expect(below.maxHeight).toBe(114);
  });
});
