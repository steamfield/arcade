/**
 * Where text over the water sits beside the player (UI.md "Race HUD"): the hint lines and the
 * DASH! prompt centre on x 168, the middle of the safe column (x 108-228) that stays clear of the
 * d-pad and A/B zones at every height, with a y that follows the player but never covers them.
 */

/** Text beside the player centres on this x. */
export const BESIDE_PLAYER_X = 168;
/**
 * How far the text's nearest edge stays from the player's body centre: half an inflated puffer
 * (24 px tall at 2x) plus a 4 px gap, so the text never covers the sprite.
 */
const CLEARANCE = 16;
/** The band the text may use: under the caption line (y 42-48) and above the bottom margin. */
const BAND = { top: 50, bottom: 174 } as const;

/**
 * Where text `height` px tall centres vertically, in screen px, beside a player whose body centre
 * is at screen y `playerY`: above the player when there is room under the caption line, else below,
 * kept inside the band either way.
 */
export function besidePlayerY(playerY: number, height: number): number {
  const half = Math.ceil(height / 2);
  const above = playerY - CLEARANCE - half;
  if (above - half >= BAND.top) return Math.round(above);
  const below = Math.min(playerY + CLEARANCE + half, BAND.bottom - half);
  return Math.round(Math.max(below, BAND.top + half));
}
