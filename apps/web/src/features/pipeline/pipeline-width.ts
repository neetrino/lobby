const MIN_WIDTH = 220;
const MAX_WIDTH = 640;

/** Matches the API limit so a drag cannot store an out-of-range width. */
export function clampColumnWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
}
