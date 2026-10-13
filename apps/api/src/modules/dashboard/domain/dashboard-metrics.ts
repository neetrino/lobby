/** Percent change against the previous window. Zero baseline has no trend. */
export function trendPercent(current: number, previous: number): number | null {
  if (previous <= 0) {
    return null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
