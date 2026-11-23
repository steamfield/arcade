/**
 * The two painted parallax layers behind the course, each tiling horizontally: a far ridge of
 * pines and a near line of thick trunks. Two dark colours each, a step off the canopy bands, so
 * they recede.
 */
import { Frame } from '../../../art/keys.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { ForestTex, type ForestTexKey } from '../keys.ts';
import { ForestBackdropPalette } from '../palettes.ts';
import { type Pine, pineRidge, type Trunk, trunkLine } from './trees.ts';

/** Width of both layers in px; the layer repeats every this many pixels. */
const LAYER_WIDTH = 128;
const FAR_HEIGHT = 64;
const NEAR_HEIGHT = 80;
/** Rows of earth the far pines stand on. */
const FAR_BANK_ROWS = 6;

/** Far pines, uneven in height and spacing so the ridge doesn't repeat inside one tile. */
const FAR_PINES: readonly Pine[] = [
  { x: 8, top: 22, tiers: 5 },
  { x: 24, top: 34, tiers: 4 },
  { x: 42, top: 16, tiers: 6 },
  { x: 60, top: 30, tiers: 4 },
  { x: 76, top: 24, tiers: 5 },
  { x: 93, top: 36, tiers: 3 },
  { x: 108, top: 18, tiers: 6 },
  { x: 122, top: 32, tiers: 4 },
];

/** Near trunks, wide and few. */
const NEAR_TRUNKS: readonly Trunk[] = [
  { x: 10, width: 7 },
  { x: 47, width: 5 },
  { x: 74, width: 8 },
  { x: 112, width: 5 },
];

/** Backdrop layer sheets. */
export const BACKDROP_SHEETS: readonly ArtSheet<ForestTexKey>[] = [
  sheet(ForestTex.backdropFar, ForestBackdropPalette.far, {
    [Frame.a]: pineRidge(LAYER_WIDTH, FAR_HEIGHT, FAR_PINES, FAR_BANK_ROWS),
  }),
  sheet(ForestTex.backdropNear, ForestBackdropPalette.near, {
    [Frame.a]: trunkLine(LAYER_WIDTH, NEAR_HEIGHT, NEAR_TRUNKS),
  }),
];
