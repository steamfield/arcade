/**
 * Every forest sprite sheet in one list, gathered from the family files so the theme's texture
 * builder and its art data test walk the same set.
 */
import type { ArtSheet } from '../../../art/sprites/sheet.ts';
import type { ForestTexKey } from '../keys.ts';
import { BACKDROP_SHEETS } from './backdrop.ts';
import { FLOW_SHEETS } from './flow.ts';
import { TERRAIN_SHEETS } from './terrain.ts';

/** All forest art, one entry per texture key in `ForestTex`. */
export const FOREST_SHEETS: readonly ArtSheet<ForestTexKey>[] = [...TERRAIN_SHEETS, ...FLOW_SHEETS, ...BACKDROP_SHEETS];
