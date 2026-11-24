/**
 * The ocean theme's colours: reef and cave terrain, sky, the painted backdrop layers, the water's
 * depth bands and the light in it. Terrain is mid-value, the water and backdrop dark, blue and low
 * in saturation, so the world's sprites (brighter and more saturated) read in front. Each racer's
 * main colour and each hazard's body hold 3:1 off every water band, sky and backdrop colour
 * (`OCEAN_CONTRAST_BANDS` in `ocean.ts`), so the water is kept dark enough at the surface.
 */
import type { Palette } from '../../art/pixel.ts';

/** The sky colour, shared by the sky tile and the waterline's wave troughs so they meet without a seam. */
const SKY = 0x24497e;

/** Course palettes. Terrain is mid-value so racers and hazards in front of it still pop. */
export const TerrainPalette = {
  /** Cracks, stone, lit stone, sunlit edge. */
  rock: [0x1c1626, 0x362e4a, 0x4e4466, 0x6a6084],
  /** Breakable coral: deep, body, light, tips. Warm, so it reads apart from rock at a glance. */
  coral: [0x5a1838, 0xc8406a, 0xf47e8c, 0xffd0b8],
  /** Kelp: dark stem, blade, lit edge. Muted so racers inside it still read. */
  kelp: [0x0e3426, 0x1d6640, 0x3c9a52],
  /** Current streaks: faint and bright, light on dark water so the flow reads without hiding racers. */
  current: [0x3f8fbf, 0x9ae8ff],
  /** Finish banner: post, dark check, light check, flag cloth. */
  finish: [0x16161e, 0x2a2a3a, 0xf2f2f2, 0xffcc33],
  /** Open sky over the sea: one dusky blue, no lighter than the shallowest water, so racers breaching into it still read. */
  sky: [SKY],
  /** The waterline: lit water under the crest, the crest, its foam, and sky between the wave tops. */
  waterline: [0x2a6a9a, 0x7cc8e8, 0xd8f6ff, SKY],
  /** Cave stone: cracks, stone, lit stone, edge. Darker and bluer than reef rock, so a cave reads apart from the reef. */
  caveStone: [0x0c0e1c, 0x1c2438, 0x2a3650, 0x3e5070],
} as const satisfies Record<string, Palette>;

/** Backdrop palettes: dark, desaturated blues a step away from the water behind them. */
export const BackdropPalette = {
  /** Far reef: silhouette and its faintly lit crest. */
  far: [0x0b2a48, 0x103458],
  /** Mid kelp forest: shadowed stems, blades. */
  near: [0x061a2c, 0x0a243a],
  /** Cave wall behind dark stretches: near-black stone, a shade lighter, faint lit flecks. */
  caveWall: [0x080a14, 0x0e1220, 0x141a2c],
} as const satisfies Record<string, Palette>;

/** The water itself, shallow to deep, one colour per depth band. */
export const WATER_BANDS: readonly number[] = [0x1c5480, 0x184a74, 0x144068, 0x10365a, 0x0d2d4e, 0x0a2442, 0x081c36];

/** Light in the water: god rays and the caustic shimmer near the surface, drawn translucent over the bands. */
export const WaterLight = {
  ray: 0xbfeaff,
  caustic: 0xd8f6ff,
  mote: 0x9fd4ee,
} as const;

/** Whirlpool streaks inherit the look of currents, with the waterline's foam at the rim. */
export const WhirlpoolPalette = {
  streak: TerrainPalette.current[0],
  crest: TerrainPalette.current[1],
  foam: TerrainPalette.waterline[2],
} as const;
