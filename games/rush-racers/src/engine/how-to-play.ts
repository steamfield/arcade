/**
 * How to Play's paging, as plain state and moves: which page is up and what a press does. The
 * runtime feeds it input each tick and the scene only draws the page it is told.
 */

/**
 * Pages in How to Play: swim and dash, clams and charges, fire and swap, pearls, bonking enemies,
 * the attack power-ups, dodging a squid.
 */
export const HOW_TO_PLAY_PAGES = 7;

/** The buttons that move through the pages. */
export type PagePress = 'fire' | 'dash' | 'right' | 'left';

/** Where a press leads: another page (or the same one), or out of How to Play to the title. */
export type PageOutcome = { kind: 'page'; page: number } | { kind: 'leave' };

/**
 * The outcome of `press` on page `page` (0-based). Fire (A) and right go forward, dash (B) and
 * left go back. Left and right stop at the first and last page; only B on the first page and A on
 * the last page leave, so a stray d-pad press never throws a child out of the screen.
 */
export function turnPage(page: number, press: PagePress): PageOutcome {
  const last = HOW_TO_PLAY_PAGES - 1;
  switch (press) {
    case 'fire':
      return page >= last ? { kind: 'leave' } : { kind: 'page', page: page + 1 };
    case 'dash':
      return page <= 0 ? { kind: 'leave' } : { kind: 'page', page: page - 1 };
    case 'right':
      return { kind: 'page', page: Math.min(last, page + 1) };
    case 'left':
      return { kind: 'page', page: Math.max(0, page - 1) };
  }
}
