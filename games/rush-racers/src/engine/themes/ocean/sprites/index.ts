/**
 * Every ocean sprite sheet in one list, gathered from the family files so the theme's texture
 * builder and its art data test walk the same set.
 */
import type { ArtSheet } from '../../../art/sprites/sheet.ts';
import type { OceanTexKey } from '../keys.ts';
import { BACKDROP_SHEETS } from './backdrop.ts';
import { CAVE_SHEETS } from './cave.ts';
import { CURRENT_SHEETS } from './currents.ts';
import { SURFACE_SHEETS } from './surface.ts';
import { TERRAIN_SHEETS } from './terrain.ts';

/** All ocean art, one entry per texture key in `OceanTex`. */
export const OCEAN_SHEETS: readonly ArtSheet<OceanTexKey>[] = [
  ...TERRAIN_SHEETS,
  ...CURRENT_SHEETS,
  ...BACKDROP_SHEETS,
  ...SURFACE_SHEETS,
  ...CAVE_SHEETS,
];
