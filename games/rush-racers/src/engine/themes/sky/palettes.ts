/**
 * The sky theme's colours: Cloudreach's thunderheads, puff, bounce and fog clouds, wind, spark clouds
 * and static wisps, the far and near cloud banks, the sky's bands, the sunlight through it and the
 * storm cell's tint. A daytime sky, deep blue overhead and hazier toward the ground, but held no
 * lighter than the racers allow: every racer's main colour and all global art hold 3:1 off every sky
 * band and cloud bank (the sky theme's contrast bands, checked in `art/sprites/sprites.test.ts`), so
 * the haze near the bottom is no lighter than the ocean's surface water. Terrain is
 * mid-value or pale and hazards bright, so they read in front of the sky. Lanes may tune these only
 * while every contrast test still passes.
 */
import type { Palette } from '../../art/pixel.ts';

/** Course palettes. A thunderhead is a dark, solid block; a puff cloud is clearly softer and paler. */
export const SkyTerrainPalette = {
  /** Thunderhead (rock): outline, grey-violet body, lit body, the lit top edge. Mid-value, so racers pop on it. */
  thunderhead: [0x1e1a30, 0x4e4868, 0x7a7298, 0xb4acd0],
  /** Puff cloud (coral, breakable): cool outline, cool shade, off-white body, white highlight. */
  puffCloud: [0x5a6a92, 0xb8c6e0, 0xeef2f8, 0xffffff],
  /** Bounce cloud: shadow, pale body, warm rim, the rim's lit coil. Warm where the puff is cool. */
  bounceCloud: [0x8a6a6a, 0xf6ece4, 0xffaa6a, 0xffd8a8],
  /** Fog bank (kelp): its haze and the brighter wisps through it. Drawn translucent, so racers show through. */
  fog: [0x8a9ab8, 0xc8d2e4],
  /** Wind gusts and drafts: faint and bright, so they read without hiding racers. */
  wind: [0x7a9ac8, 0xe4eeff],
  /** Finish banner: post, dark check, light check, flag cloth. */
  finish: [0x16161e, 0x2a2a3a, 0xf2f2f2, 0xffcc33],
} as const satisfies Record<string, Palette>;

/** Hazard palettes: dark outlines with bright bodies, so danger reads by shape and value, not hue alone. */
export const SkyHazardPalette = {
  /** Spark cloud (the urchin's slot): outline, a lit violet body that holds 3:1 off the sky, yellow sparks. */
  sparkCloud: [0x1a1030, 0xc0a8e8, 0xfff060],
  /** Static wisp (the jelly's slot): outline, ice-blue body, white crackle. */
  staticWisp: [0x1a2448, 0x9ad8ff, 0xf4fcff],
} as const satisfies Record<string, Palette>;

/** Backdrop palettes: cloud banks a step away from the bands behind them, kept as dark as the bands allow. */
export const SkyBackdropPalette = {
  /** Far cloud banks: silhouette and its sunlit crown. */
  far: [0x2a426e, 0x304872],
  /** Near cloud banks: shadowed underside, lit edge. */
  near: [0x203a66, 0x263f6a],
} as const satisfies Record<string, Palette>;

/** The open sky from the top of the level down to the ground: deep blue overhead, a hazy band at the bottom. */
export const SKY_BANDS: readonly number[] = [0x0e2c64, 0x143670, 0x1a3e78, 0x22467e, 0x2c4c80, 0x364e7c, 0x444e72];

/** Sunlight in the sky: the shafts from the top of the level and the specks drifting across it. */
export const SunLight = {
  ray: 0xfff4d0,
  mote: 0xf0f4ff,
} as const;

/** The veil over a lightning zone's storm cell: a dark slate-violet, drawn translucent. */
export const STORM_TINT = 0x1c1838;
