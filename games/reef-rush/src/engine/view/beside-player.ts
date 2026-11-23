/**
 * Where text over the water sits beside the player (UI.md "Race HUD"): the hint lines and the
 * DASH! prompt centre on the middle of the safe column (`ScreenLayout.besideX`, x 168 on the base)
 * that stays clear of the d-pad and A/B zones at every height, with a y that follows the player but
 * never covers them.
 */
import { BASE_LAYOUT, type ScreenLayout } from './screen-layout.ts';

/**
 * How far the text's nearest edge stays from the player's body centre: half an inflated puffer
 * (24 px tall at 2x) plus a 4 px gap, so the text never covers the sprite.
 */
const CLEARANCE = 16;
/** The band the text may use starts under the caption line (y 42-48) and ends at the bottom margin. */
const BAND_TOP = 50;

/**
 * Where text `height` px tall centres vertically, in screen px, beside a player whose body centre
 * is at screen y `playerY`: above the player when there is room under the caption line, else below,
 * kept inside the band either way.
 */
export function besidePlayerY(playerY: number, height: number, layout: ScreenLayout = BASE_LAYOUT): number {
  const half = Math.ceil(height / 2);
  const above = playerY - CLEARANCE - half;
  if (above - half >= BAND_TOP) return Math.round(above);
  const below = Math.min(playerY + CLEARANCE + half, layout.lowest - half);
  return Math.round(Math.max(below, BAND_TOP + half));
}
