/**
 * The space theme's colours: Farside's earth and cracked stone, branches, dust, thorn bushes and
 * orbs, the painted tree layers, the canopy's depth bands and the light through it. As in the ocean,
 * terrain is mid-value and the air and backdrop dark, green and low in saturation, so racers, hazards
 * and pickups read in front. Every racer's main colour and the thorn bush's body hold 3:1 off every
 * canopy band and backdrop colour (the space theme's contrast bands), so the canopy is kept as dark
 * as the ocean's water. Lanes may tune these only while every contrast test still passes.
 */
import type { Palette } from '../../art/pixel.ts';

/** Course palettes. Terrain is mid-value so racers and hazards in front of it still pop. */
export const SpaceTerrainPalette = {
  /** Earth: deep soil, soil, lit soil, the grass on top. */
  earth: [0x1e140e, 0x3e2a1c, 0x5a3e28, 0x5c8a3a],
  /** Cracked stone: cracks, stone, lit stone, moss. Grey and cool, so it reads apart from earth. */
  crackedIce: [0x24242c, 0x6a6a78, 0x9a9aa8, 0x6e9a4a],
  /** Branch: bark shadow, bark, lit bark. Thin and warm, a platform you jump up through. */
  branch: [0x2a160c, 0x6b4423, 0x9a6a3a],
  /** Dust: dark, body, wet shine. Muted so racers inside it still read. */
  dust: [0x1c120a, 0x3a2614, 0x5e4228],
  /** Wind streaks and leaves: faint and bright, so gusts and drafts read without hiding racers. */
  wind: [0x6a9a6a, 0xd8f0c0],
  /** Finish banner: post, dark check, light check, flag cloth. */
  finish: [0x16161e, 0x2a2a3a, 0xf2f2f2, 0xffcc33],
} as const satisfies Record<string, Palette>;

/** Hazard palettes: dark bodies with hot accents, so danger reads by shape and value, not hue alone. */
export const SpaceHazardPalette = {
  /** Thorn bush: near-black stems, a lit pink body that holds 3:1 off the lightest canopy band, thorn tips. */
  mine: [0x140810, 0xe888b0, 0xffd0a0],
  /** Orb: outline, yellow body, black stripes and wing shine. */
  orb: [0x1a1206, 0xffd23a, 0x2a2010, 0xe8f4ff],
} as const satisfies Record<string, Palette>;

/** Backdrop palettes: dark, desaturated greens a step away from the canopy behind them. */
export const SpaceBackdropPalette = {
  /** Far trees: silhouette and its faintly lit crown. */
  far: [0x16183c, 0x1c2048],
  /** Near trunks: shadowed bark, lit bark edge. */
  near: [0x0c0c20, 0x121430],
} as const satisfies Record<string, Palette>;

/** The air under the canopy, from the treetops down to the space floor, one colour per band. */
export const VOID_BANDS: readonly number[] = [0x14143a, 0x121234, 0x10102e, 0x0e0e28, 0x0c0c22, 0x0a0a1c, 0x080816];

/** Light through the canopy: sun shafts, a dappled shimmer near the treetops and floating pollen. */
export const StarLight = {
  ray: 0xc8d8ff,
  dapple: 0xe0e8ff,
  mote: 0xf4f6ff,
} as const;
