/**
 * Every global world sprite sheet in one list, gathered from the family files so the art builder
 * and the art data test walk the same set. A theme's sheets live with the theme.
 */
import { ENEMY_SHEETS } from './enemies.ts';
import { GUIDE_SHEETS } from './guide.ts';
import { HUD_SHEETS } from './hud.ts';
import { PICKUP_SHEETS } from './pickups.ts';
import { POWERUP_SHEETS } from './powerups.ts';
import { RACER_SHEETS } from './racers.ts';
import type { ArtSheet } from './sheet.ts';

export type { ArtSheet } from './sheet.ts';

/** All global world art, one entry per texture key in `keys.ts`. */
export const ART_SHEETS: readonly ArtSheet[] = [
  ...RACER_SHEETS,
  ...PICKUP_SHEETS,
  ...POWERUP_SHEETS,
  ...HUD_SHEETS,
  ...GUIDE_SHEETS,
  ...ENEMY_SHEETS,
];
