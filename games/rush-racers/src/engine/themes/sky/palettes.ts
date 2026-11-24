/**
 * The sky theme's colours: Cloudreach's thunderheads, puff, bounce and fog clouds, wind, the far and
 * near cloud banks and the setting sun, the sky's bands, the evening
 * haze across them and the storm cell's tint. A sky at dusk, twilight indigo overhead and dusky rose
 * at the horizon, held no lighter than the racers allow: every racer's main colour and all global art
 * hold 3:1 off every sky band, every band seen through the haze, and every cloud bank and the sun
 * (the sky theme's contrast bands, checked in `art/sprites/sprites.test.ts`). So nothing behind play
 * is lighter than the ocean's surface water, and the sun and haze are no brighter than the lowest
 * band. Terrain is mid-value or pale and hazards bright, so they read in front of the sky; the pale
 * puff and bounce clouds are the bright accents. Lanes may tune these only while every contrast test
 * still passes.
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
  sunlitBank: [0x4e4868, 0x9e7483, 0xe4a58b, 0xffdcaf],
  crowRoost: [0x372b42, 0x4e4868, 0x94718c, 0xd2a18a],
  cannonRigging: [0x292b50, 0x464f75, 0x7386a0, 0xeab37a],
} as const satisfies Record<string, Palette>;

/** Backdrop palettes: cloud banks a step away from the bands behind them, kept as dark as the bands allow. */
export const SkyBackdropPalette = {
  /** Far cloud banks: violet silhouette, its crown lit dusky rose, and the setting sun half hidden behind them. */
  far: [0x3e3a6a, 0x5c3e54, 0x843814],
  /** Near cloud banks: shadowed underside, and the edge the low sun lights rose. */
  near: [0x302e60, 0x503652],
} as const satisfies Record<string, Palette>;

/**
 * The open sky from the top of the level down to the ground: twilight indigo overhead, warming
 * through violet to a hazy dusky rose at the horizon.
 */
export const SKY_BANDS: readonly number[] = [0x1c2060, 0x22266a, 0x2a2c70, 0x343476, 0x4a4078, 0x564474, 0x5c4866];

/** The evening haze streaked across the sky: a dusky rose no lighter than the horizon band. */
export const EVENING_HAZE = 0x68445a;

/** The veil over a sky course's dark stretches (`level.dark`): a dark slate-violet, drawn translucent. */
export const STORM_TINT = 0x1c1838;
