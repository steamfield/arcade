/**
 * Every world sprite sheet in one list, gathered from the family files so the
 * art builder and the art data test walk the same set.
 */
import { BACKDROP_SHEETS } from './backdrop.ts';
import { CURRENT_SHEETS } from './currents.ts';
import { HAZARD_SHEETS } from './hazards.ts';
import { HUD_SHEETS } from './hud.ts';
import { PICKUP_SHEETS } from './pickups.ts';
import { POWERUP_SHEETS } from './powerups.ts';
import { RACER_SHEETS } from './racers.ts';
import type { ArtSheet } from './sheet.ts';
import { TERRAIN_SHEETS } from './terrain.ts';

export type { ArtSheet } from './sheet.ts';

/** All world art, one entry per texture key in `keys.ts`. */
export const ART_SHEETS: readonly ArtSheet[] = [
  ...TERRAIN_SHEETS,
  ...CURRENT_SHEETS,
  ...RACER_SHEETS,
  ...PICKUP_SHEETS,
  ...HAZARD_SHEETS,
  ...POWERUP_SHEETS,
  ...HUD_SHEETS,
  ...BACKDROP_SHEETS,
];
