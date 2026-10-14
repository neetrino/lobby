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

  it('keeps a tall calendar fully inside the viewport', () => {
    const box = menuPlacement({
      ...frame,
      anchorTop: 620,
      anchorBottom: 662,
      boundsTop: 8,
      boundsBottom: 792,
      menuHeight: 360,
      limit: 640,
      contain: true,
    });
    expect(box.capped).toBe(false);
    expect(box.top).toBeGreaterThanOrEqual(8);
    expect(box.top + 360).toBeLessThanOrEqual(792);
  });

  it('shifts a tall calendar up when neither side fits it', () => {
    const box = menuPlacement({
      ...frame,
      anchorTop: 180,
      anchorBottom: 220,
      boundsTop: 8,
      boundsBottom: 400,
      menuHeight: 360,
      limit: 640,
      contain: true,
    });
    expect(box.capped).toBe(false);
    expect(box.top).toBe(40);
    expect(box.top + 360).toBeLessThanOrEqual(400);
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
