/**
 * Every space sprite sheet in one list, gathered from the family files (the shape drawers in
 * `grid.ts`, `stars.ts` and `moonscape.ts` feed `backdrop.ts`) so the theme's texture
 * builder and its art data test walk the same set.
 */
import type { ArtSheet } from '../../../art/sprites/sheet.ts';
import type { SpaceTexKey } from '../keys.ts';
import { BACKDROP_SHEETS } from './backdrop.ts';
import { FLOW_SHEETS } from './flow.ts';
import { HAZARD_SHEETS } from './hazards.ts';
import { TERRAIN_SHEETS } from './terrain.ts';

/** All space art, one entry per texture key in `SpaceTex`. */
export const SPACE_SHEETS: readonly ArtSheet<SpaceTexKey>[] = [
  ...TERRAIN_SHEETS,
  ...FLOW_SHEETS,
  ...HAZARD_SHEETS,
  ...BACKDROP_SHEETS,
];
