/**
 * The forest theme's colours: Thornwood's earth and cracked stone, branches, mud, the painted tree
 * layers, the canopy's depth bands and the light through it. As in the ocean, terrain is mid-value
 * and the air and backdrop dark, green and low in saturation, so racers, hazards and pickups read in
 * front. Every racer's main colour and each hazard's body hold 3:1 off every
 * canopy band and backdrop colour (the forest theme's contrast bands), so the canopy is kept as dark
 * as the ocean's water. Lanes may tune these only while every contrast test still passes.
 */
import type { Palette } from '../../art/pixel.ts';

/** Course palettes. Terrain is mid-value so racers and hazards in front of it still pop. */
export const ForestTerrainPalette = {
  /** Earth: deep soil, soil, lit soil, the grass on top. */
  earth: [0x1e140e, 0x3e2a1c, 0x5a3e28, 0x5c8a3a],
  /** Cracked stone: cracks, stone, lit stone, moss. Grey and cool, so it reads apart from earth. */
  crackedStone: [0x24242c, 0x6a6a78, 0x9a9aa8, 0x6e9a4a],
  /** Branch: bark shadow, bark, lit bark. Thin and warm, a platform you jump up through. */
  branch: [0x2a160c, 0x6b4423, 0x9a6a3a],
  /**
   * Spring mushroom: outline and the soil round its stem (earth's deep soil), red cap, cream spots
   * and stem, the cap's shaded rim. Bright, so a spring reads as a toy.
   */
  mushroom: [0x1e140e, 0xd0402c, 0xf2e2c4, 0x8a2418],
  /** Mud: dark, body, wet shine. Muted so racers inside it still read. */
  mud: [0x1c120a, 0x3a2614, 0x5e4228],
  /** Wind streaks and leaves: faint and bright, so gusts and drafts read without hiding racers. */
  wind: [0x6a9a6a, 0xd8f0c0],
  /** Finish banner: post, dark check, light check, flag cloth. */
  finish: [0x16161e, 0x2a2a3a, 0xf2f2f2, 0xffcc33],
} as const satisfies Record<string, Palette>;

/** Split bark, pale wood exposed by a crack, and the new leaves on a regrown branch. */
export const CrumblePalette = {
  split: ForestTerrainPalette.branch[0],
  bark: ForestTerrainPalette.branch[2],
  rawWood: 0xd5a46b,
  stem: 0x6c9944,
  leaf: 0xb4d27c,
} as const;

/** Backdrop palettes: dark, desaturated greens a step away from the canopy behind them. */
export const ForestBackdropPalette = {
  /** Far trees: silhouette and its faintly lit crown. */
  far: [0x0e2a1e, 0x123224],
  /** Near trunks: shadowed bark, lit bark edge. */
  near: [0x081a12, 0x0c2218],
} as const satisfies Record<string, Palette>;

/** The air under the canopy, from the treetops down to the forest floor, one colour per band. */
export const WOOD_BANDS: readonly number[] = [0x2a5a40, 0x245038, 0x1f4632, 0x1a3c2c, 0x153226, 0x112a20, 0x0d221a];

/** Light through the canopy: sun shafts, a dappled shimmer near the treetops and floating pollen. */
export const CanopyLight = {
  ray: 0xf0f0b0,
  dapple: 0xe8f4c0,
  mote: 0xd8e8a0,
} as const;
