/**
 * How to Play's paging, as plain state and moves: which page is up and what a press does. The
 * runtime feeds it input each tick and the scene only draws the page it is told.
 */

/** Pages in How to Play: swim and kick, clams, B uses everything, the attack power-ups. */
export const HOW_TO_PLAY_PAGES = 4;

/** What a press asks for: the next page or the previous one. */
export type PageTurn = 'next' | 'back';

/** Where a press leads: another page, or out of How to Play to the title. */
export type PageOutcome = { kind: 'page'; page: number } | { kind: 'leave' };

/**
 * The outcome of `turn` on page `page` (0-based). Next on the last page and back on the first both
 * leave, so a player is never stuck at either end.
 */
export function turnPage(page: number, turn: PageTurn): PageOutcome {
  const target = turn === 'next' ? page + 1 : page - 1;
  if (target < 0 || target >= HOW_TO_PLAY_PAGES) return { kind: 'leave' };
  return { kind: 'page', page: target };
}
