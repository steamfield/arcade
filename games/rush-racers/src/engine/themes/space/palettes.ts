/**
 * The space theme's colours: Farside's asteroid rock and ice, struts, nebula dust, solar wind, the
 * painted moonscape layers, the sky's depth bands and the starlight. As in the ocean, terrain is
 * mid-value and the sky and backdrop dark and low in saturation, so racers, hazards and pickups read
 * in front. Every racer's main colour and each hazard's body hold 3:1 off every
 * sky band and backdrop colour (the space theme's contrast bands). Tune these only while every
 * contrast test still passes.
 */
import type { Palette } from '../../art/pixel.ts';

/** Course palettes. Terrain is mid-value so racers and hazards in front of it still pop. */
export const SpaceTerrainPalette = {
  /**
   * Asteroid rock: crater shadow, rock, lit rock, the sunlit rim. Grey-violet; the rock holds 2:1 and the
   * rim 5:1 off every sky band, while the rock stays dark enough that every racer holds 3.4:1 on it.
   */
  earth: [0x24223a, 0x4c4a68, 0x625f88, 0x8a88b0],
  /** Ice: cracks, ice, lit ice, frost. Pale blue, so it reads apart from rock. */
  crackedIce: [0x1e2c44, 0x6f9cc8, 0xa8d0f0, 0xe4f4ff],
  /** Strut: shadowed metal, metal, lit metal. */
  branch: [0x1a1c26, 0x4a5064, 0x8088a0],
  /** Nebula dust: dark, body, bright wisp. Violet, the body 2:1 and the wisp 3:1 off the sky, sparse so racers inside still read. */
  dust: [0x1e1234, 0x5c3e8c, 0x7a58b8],
  /** Solar wind streaks: faint and bright, so the wind reads without hiding racers. */
  wind: [0x8a7a3a, 0xffe9a0],
  /** Finish gate: pylon (3.6:1 off the sky), dark check, light check, beacon. */
  finish: [0x6e7090, 0x2a2a3a, 0xf2f2f2, 0xffcc33],
} as const satisfies Record<string, Palette>;

/** Backdrop palettes: dark blues a step away from the sky behind them. */
export const SpaceBackdropPalette = {
  /** The far layer: no sprite draws these (the far layer is all stars); they stay in the contrast bands only. */
  far: [0x16183c, 0x1c2048],
  /** The near layer: shadow and a lit edge about 1.6:1 off the sky. */
  near: [0x0c0c20, 0x323672],
} as const satisfies Record<string, Palette>;

/** The sky from the top of the screen to the bottom, one colour per band. */
export const VOID_BANDS: readonly number[] = [0x14143a, 0x121234, 0x10102e, 0x0e0e28, 0x0c0c22, 0x0a0a1c, 0x080816];

/** Starlight: faint stars (about 2.4:1 off the sky), lit stars, shimmer and the brightest stars. */
export const StarLight = {
  faint: 0x4a5280,
  ray: 0xc8d8ff,
  dapple: 0xe0e8ff,
  mote: 0xf4f6ff,
} as const;

/** Bright rims for the paired mouths, plus a dark centre against the starfield. */
export const WormholePalette = {
  rims: [0x80ddff, 0xffbb75, 0xcfadff, 0x8ff3c5, 0xff9eb8, 0xf5e891],
  centre: 0x080816,
} as const;
