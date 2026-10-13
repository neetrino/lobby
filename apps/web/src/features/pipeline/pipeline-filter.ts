import type { PipelineCard } from './pipeline-api';

/** Keeps cards whose title or company matches, and whose team status is selected. */
export function shownCards(cards: PipelineCard[], query: string, statusId: string): PipelineCard[] {
  const needle = query.trim().toLowerCase();
  return cards.filter((card) => matchesCard(card, needle, statusId));
}

function matchesCard(card: PipelineCard, needle: string, statusId: string): boolean {
  const text = `${card.title} ${card.company}`.toLowerCase();
  const matchesText = needle === '' || text.includes(needle);
  const matchesStatus = statusId === '' || card.statusId === statusId;
  return matchesText && matchesStatus;
}
