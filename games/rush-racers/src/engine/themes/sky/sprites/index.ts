/**
 * Every sky sprite sheet in one list, gathered from the family files so the theme's texture builder
 * and its art data test walk the same set.
 */
import type { ArtSheet } from '../../../art/sprites/sheet.ts';
import type { SkyThemeTexKey } from '../keys.ts';
import { BACKDROP_SHEETS } from './backdrop.ts';
import { FLOW_SHEETS } from './flow.ts';
import { HAZARD_SHEETS } from './hazards.ts';
import { TERRAIN_SHEETS } from './terrain.ts';

/** All sky art, one entry per texture key in `SkyThemeTex`. */
export const SKY_SHEETS: readonly ArtSheet<SkyThemeTexKey>[] = [
  ...TERRAIN_SHEETS,
  ...FLOW_SHEETS,
  ...HAZARD_SHEETS,
  ...BACKDROP_SHEETS,
];
