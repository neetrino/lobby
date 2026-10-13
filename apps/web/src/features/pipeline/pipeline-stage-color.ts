const STAGE_COLORS = ['#b86e24', '#0f4c4a', '#4c1d95', '#0f2744', '#be185d', '#e07a3d'] as const;

/** Stable column color. The same index keeps the same color on every card. */
export function stageColor(index: number): string {
  return STAGE_COLORS[index % STAGE_COLORS.length] ?? STAGE_COLORS[0];
}

export function stageColors(count: number): string[] {
  return Array.from({ length: count }, (_, index) => stageColor(index));
}
