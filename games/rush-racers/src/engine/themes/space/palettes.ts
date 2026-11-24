/**
 * The space theme's colours: Farside's asteroid rock and ice, struts, nebula dust, solar wind, space
 * mines and plasma orbs, the painted moonscape layers, the sky's depth bands and the starlight. As in
 * the ocean, terrain is mid-value and the sky and backdrop dark and low in saturation, so racers,
 * hazards and pickups read in front. Every racer's main colour and the mine's body hold 3:1 off every
 * sky band and backdrop colour (the space theme's contrast bands). Tune these only while every
 * contrast test still passes.
 */
import type { Palette } from '../../art/pixel.ts';

/** Course palettes. Terrain is mid-value so racers and hazards in front of it still pop. */
export const SpaceTerrainPalette = {
  /** Asteroid rock: crater shadow, rock, lit rock, the sunlit rim. Grey-violet, a step lighter than the sky. */
  earth: [0x1c1a2a, 0x3c3a52, 0x57557a, 0x8a88b0],
  /** Ice: cracks, ice, lit ice, frost. Pale blue, so it reads apart from rock. */
  crackedIce: [0x1e2c44, 0x6f9cc8, 0xa8d0f0, 0xe4f4ff],
  /** Strut: shadowed metal, metal, lit metal. */
  branch: [0x1a1c26, 0x4a5064, 0x8088a0],
  /** Nebula dust: dark, body, bright wisp. Muted violet so racers inside it still read. */
  dust: [0x1e1234, 0x3c2460, 0x64409a],
  /** Solar wind streaks: faint and bright, so the wind reads without hiding racers. */
  wind: [0x8a7a3a, 0xffe9a0],
  /** Finish gate: pylon, dark check, light check, beacon. */
  finish: [0x16161e, 0x2a2a3a, 0xf2f2f2, 0xffcc33],
} as const satisfies Record<string, Palette>;

/** Hazard palettes: dark bodies with hot accents, so danger reads by shape and value, not hue alone. */
export const SpaceHazardPalette = {
  /** Space mine: near-black rivets, a lit pink body that holds 3:1 off the lightest sky band, spike tips. */
  mine: [0x140810, 0xe888b0, 0xffd0a0],
  /** Plasma orb: outline, yellow body, dark core band and white-hot shine. */
  orb: [0x1a1206, 0xffd23a, 0x2a2010, 0xe8f4ff],
} as const satisfies Record<string, Palette>;

/** Backdrop palettes: dark blues a step away from the sky behind them. */
export const SpaceBackdropPalette = {
  /** The far layer: silhouette and its faintly lit edge. */
  far: [0x16183c, 0x1c2048],
  /** The near layer: shadow and lit edge. */
  near: [0x0c0c20, 0x121430],
} as const satisfies Record<string, Palette>;

/** The sky from the top of the screen to the bottom, one colour per band. */
export const VOID_BANDS: readonly number[] = [0x14143a, 0x121234, 0x10102e, 0x0e0e28, 0x0c0c22, 0x0a0a1c, 0x080816];

/** Starlight: shafts, shimmer and the brightest stars. */
export const StarLight = {
  ray: 0xc8d8ff,
  dapple: 0xe0e8ff,
  mote: 0xf4f6ff,
} as const;
