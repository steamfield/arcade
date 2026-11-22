/**
 * Every colour the world art uses, as named palettes of at most 4 colours per
 * sprite (index 0 is digit `0` in the pixel text). The value ladder is chosen
 * so gameplay reads before scenery: racers, hazards and pickups carry the
 * brightest and most saturated colours with a near-black outline, terrain sits
 * in the middle, and the water and backdrop stay dark, blue and low in
 * saturation. Each racer's main colour (and the urchin's body) holds at least
 * 3:1 contrast against every water band, so the water is kept dark enough for
 * that to hold at the surface. The eight characters' palettes live with their
 * sprites in `sprites/racers.ts` (`CharacterPalette`); shape, not brightness,
 * tells them apart.
 */
import type { Palette } from './pixel.ts';

/** The original four racers' palettes, now used only by the HUD marker sheet (`sprites/hud.ts`). */
export const RacerPalette = {
  /** Brass helmet and suit, pale yellow glints, dark glass porthole. */
  pip: [0x2a1a08, 0xffd050, 0xfff0b8, 0x16405e],
  /** Green shell, pale scutes and flippers. */
  tess: [0x0c2414, 0x64c868, 0xc0f088, 0x2a6a34],
  /** Violet mantle, lilac belly, white eye. */
  squib: [0x2a0a3a, 0xeab4ff, 0xf8e0ff, 0xffffff],
  /** Iron bell, pale rim and porthole, red-orange crab. */
  bo: [0x101018, 0x98a4b4, 0xd8e0ea, 0xe8562c],
} as const satisfies Record<string, Palette>;

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
} as const satisfies Record<string, Palette>;

/** Pickup and power-up palettes: bright and warm against the blue water. */
export const ItemPalette = {
  /** Pearl: outline, body, shine. */
  pearl: [0x4a4660, 0xe8e4f4, 0xffffff],
  /** Clam: outline, shell, shell light, the gold prize inside. */
  clam: [0x24163e, 0x8a6cd0, 0xd6c6ff, 0xffd23f],
  /** Loose power-up halo: two dithered rings of light. */
  looseGlow: [0xfff0a0, 0xffffff],
  /** Jet Fins: outline, blue, light, white. */
  jetFin: [0x0c1e3a, 0x2b8ce0, 0x9ad8ff, 0xffffff],
  /** Bubble Shield: outline, aqua, light, white. */
  bubbleShield: [0x0c2e3a, 0x3cc4d8, 0xb8f4ff, 0xffffff],
  /** Puffer: outline, yellow, light, spines. */
  puffer: [0x3a2008, 0xf0b030, 0xffe890, 0xa05a14],
  /** Ink Sac: outline, ink, sheen, white highlight. */
  inkSac: [0x0a0614, 0x3c2a66, 0x7a64b0, 0xffffff],
  /** Glow Lantern: outline, frame, glow, white core. */
  glowLantern: [0x2a1a08, 0x8a5a20, 0xffe060, 0xffffff],
  /** Ink cloud: core and dithered edge. */
  inkCloud: [0x0a0614, 0x241a3c],
  /** Trapping bubble: rim and shine. */
  bubble: [0xb8f4ff, 0xffffff],
} as const satisfies Record<string, Palette>;

/** Hazard palettes: dark bodies with hot accents, so danger reads by shape and value, not hue alone. */
export const HazardPalette = {
  /** Urchin: near-black spines and core, a lit lilac body that holds 3:1 in deep water, spine tips. */
  urchin: [0x0c0414, 0xc488f0, 0xff5a7a],
  /** Jellyfish: outline, bell, light bell, stinging tentacles. */
  jelly: [0x6a1a5c, 0xff70c4, 0xffc8ec, 0xffe0f4],
} as const satisfies Record<string, Palette>;

/** HUD sprite palettes. The progress markers reuse each racer's main colour with a dark outline. */
export const HudPalette = {
  markerPip: [0x0a0a14, RacerPalette.pip[1], RacerPalette.pip[2]],
  markerTess: [0x0a0a14, RacerPalette.tess[1], RacerPalette.tess[2]],
  markerSquib: [0x0a0a14, RacerPalette.squib[1], RacerPalette.squib[2]],
  markerBo: [0x0a0a14, RacerPalette.bo[3], 0xffb08a],
  /** Kick pip: outline, ready glow, ready core. Cooling uses the outline only, so state reads by shape too. */
  kickPip: [0x2a4a6a, 0x7fdbff, 0xe0f8ff],
} as const satisfies Record<string, Palette>;

/** Backdrop palettes: dark, desaturated blues a step away from the water behind them. */
export const BackdropPalette = {
  /** Far reef: silhouette and its faintly lit crest. */
  far: [0x0b2a48, 0x103458],
  /** Mid kelp forest: shadowed stems, blades. */
  near: [0x061a2c, 0x0a243a],
} as const satisfies Record<string, Palette>;

/** The water itself, shallow to deep, one colour per depth band. */
export const WATER_BANDS: readonly number[] = [0x1c5480, 0x184a74, 0x144068, 0x10365a, 0x0d2d4e, 0x0a2442, 0x081c36];

/** Light in the water: god rays and the caustic shimmer near the surface, drawn translucent over the bands. */
export const WaterLight = {
  ray: 0xbfeaff,
  caustic: 0xd8f6ff,
  mote: 0x9fd4ee,
} as const;
