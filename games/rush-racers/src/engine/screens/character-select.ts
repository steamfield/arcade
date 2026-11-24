/**
 * The select screen's plain parts, with no Phaser in them: the cursor's moves
 * over the grid (the eight characters sit in SELECT_COLUMNS columns in
 * CHARACTER_IDS order and the cursor wraps around each row and column), and
 * the words the character card shows for an ability, read from the world's cast skin. The runtime feeds the
 * cursor input; `scenes/select.ts` draws the grid and the card.
 */
import { CHARACTER_IDS, type CharacterId } from '../../logic/types.ts';
import type { AbilityText, CastSkin } from '../worlds/cast-skin.ts';

/** Characters per row on the select grid. */
export const SELECT_COLUMNS = 4;

/** Rows on the select grid. */
const SELECT_ROWS = Math.ceil(CHARACTER_IDS.length / SELECT_COLUMNS);

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

/**
 * Width in px of the card's text column, right of the large portrait (UI.md "Select"). The full
 * name in the display face and both ability lines in the text face fit it.
 */
export const CARD_TEXT_WIDTH = 144;

/** The card's ability lines for `character`, as `cast`'s world words them. */
export function abilityTextFor(character: CharacterId, cast: CastSkin): AbilityText {
  return cast.abilities[character];
}
