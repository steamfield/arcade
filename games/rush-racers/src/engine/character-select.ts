/**
 * The select screen's plain parts, with no Phaser in them: the cursor's moves
 * over the grid (the eight characters sit in SELECT_COLUMNS columns in
 * CHARACTER_IDS order and the cursor wraps around each row and column), and
 * the words the character card shows for each ability. The runtime feeds the
 * cursor input; `scenes/select.ts` draws the grid and the card.
 */
import { CHARACTERS } from '../logic/characters.ts';
import { type AbilityId, CHARACTER_IDS, type CharacterId } from '../logic/types.ts';

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

/**
 * Width in px of the card's text column, right of the large portrait (UI.md "Select"). The full
 * name in the display face and both ability lines in the text face fit it.
 */
export const CARD_TEXT_WIDTH = 144;

/** What an ability is called on screen, and one line on what it does. */
export interface AbilityText {
  name: string;
  blurb: string;
}

/** The card's words for each ability, in capitals, each line no wider than CARD_TEXT_WIDTH. */
export const ABILITY_TEXT: Readonly<Record<AbilityId, AbilityText>> = {
  shakeItOff: { name: 'SHAKE IT OFF', blurb: 'STUNS AND TRAPS END FAST' },
  springKick: { name: 'SPRING KICK', blurb: 'KICKS PUSH HARDER UPWARD' },
  windUp: { name: 'WIND-UP', blurb: 'GAINS SPEED ON STRAIGHTS' },
  ambush: { name: 'AMBUSH', blurb: 'REAR BUMPS STEAL SPEED' },
  deepPockets: { name: 'DEEP POCKETS', blurb: 'HOLDS 4 POWER-UPS, NOT 3' },
  bulldozer: { name: 'BULLDOZER', blurb: 'RAMS CORAL, HARD TO BUMP' },
  moonlight: { name: 'MOONLIGHT', blurb: 'SEES IN DARK, NO STINGS' },
  frenzy: { name: 'FRENZY', blurb: 'SURGES AS RIVALS GET HIT' },
};

/** The card's ability lines for `character`. */
export function abilityTextFor(character: CharacterId): AbilityText {
  return ABILITY_TEXT[CHARACTERS[character].ability];
}
