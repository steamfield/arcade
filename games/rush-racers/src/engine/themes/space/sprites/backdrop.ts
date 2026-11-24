/**
 * The two painted parallax layers behind the course, each tiling horizontally: a far starfield tall
 * enough to fill the sky behind a course, and a near layer with the limb of a cratered moon and a few
 * distant asteroids. The near layer is a shadow close to the sky and an edge lit about 1.6:1 off it, so
 * it recedes; the stars are single pixels of the theme's starlight, too small for a racer ever to sit on.
 */
import { Frame } from '../../../art/keys.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { SpaceTex, type SpaceTexKey } from '../keys.ts';
import { SpaceBackdropPalette, StarLight } from '../palettes.ts';
import { type Asteroid, type Horizon, moonLimb } from './moonscape.ts';
import { type StarCounts, starField } from './stars.ts';

/** Width of both layers in px; the layer repeats every this many pixels. */
const LAYER_WIDTH = 128;
/** Layer heights in px, which `space.ts` declares to the backdrop view. */
export const FAR_HEIGHT = 192;
export const NEAR_HEIGHT = 80;

/** Faint, lit and bright stars across one far tile: sparse, so racers and stardust stay the brightest things on screen. */
const FAR_STARS: StarCounts = { faint: 70, lit: 22, bright: 4 };
/** Any fixed seed: it only decides where the stars sit. */
const FAR_STAR_SEED = 7;
/** Faint, lit and bright stars, all in starlight; the faint ones about 2.4:1 off the sky. */
const STAR_PALETTE = [StarLight.faint, StarLight.ray, StarLight.mote];

/** The moon's horizon: low, gently rolling, with three craters of different sizes. */
const MOON_HORIZON: Horizon = {
  baseRows: 16,
  swell: [4, 2],
  craters: [
    { x: 20, halfWidth: 9, depth: 4 },
    { x: 70, halfWidth: 5, depth: 3 },
    { x: 104, halfWidth: 12, depth: 5 },
  ],
};

/** Distant asteroids hanging over the moon, uneven in size and height so the layer doesn't look tiled. */
const NEAR_ASTEROIDS: readonly Asteroid[] = [
  { x: 14, y: 22, radius: 3 },
  { x: 46, y: 10, radius: 2 },
  { x: 58, y: 38, radius: 5 },
  { x: 92, y: 18, radius: 2 },
  { x: 118, y: 44, radius: 3 },
];

/** Backdrop layer sheets. */
export const BACKDROP_SHEETS: readonly ArtSheet<SpaceTexKey>[] = [
  sheet(SpaceTex.backdropFar, STAR_PALETTE, {
    [Frame.a]: starField(LAYER_WIDTH, FAR_HEIGHT, FAR_STARS, FAR_STAR_SEED),
  }),
  sheet(SpaceTex.backdropNear, SpaceBackdropPalette.near, {
    [Frame.a]: moonLimb(LAYER_WIDTH, NEAR_HEIGHT, MOON_HORIZON, NEAR_ASTEROIDS),
  }),
];
