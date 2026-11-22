/**
 * The select screen's cursor as plain state moves: the eight characters sit
 * in a grid of SELECT_COLUMNS columns in CHARACTER_IDS order, and the cursor
 * wraps around each row and column. The runtime feeds it input; the select
 * scene only draws it.
 */
import { CHARACTER_IDS, type CharacterId } from '../logic/types.ts';

/** Characters per row on the select grid. */
export const SELECT_COLUMNS = 4;

/** Rows on the select grid. */
export const SELECT_ROWS = Math.ceil(CHARACTER_IDS.length / SELECT_COLUMNS);

/**
 * The character one step from `current` across the grid: `dx` moves along the row and `dy` down
 * the column, each wrapping at the edges.
 */
export function moveCharacter(current: CharacterId, dx: -1 | 0 | 1, dy: -1 | 0 | 1): CharacterId {
  const index = CHARACTER_IDS.indexOf(current);
  const column = (index % SELECT_COLUMNS) + dx;
  const row = Math.floor(index / SELECT_COLUMNS) + dy;
  const wrapped = ((row + SELECT_ROWS) % SELECT_ROWS) * SELECT_COLUMNS + ((column + SELECT_COLUMNS) % SELECT_COLUMNS);
  return CHARACTER_IDS[wrapped] ?? current;
}
