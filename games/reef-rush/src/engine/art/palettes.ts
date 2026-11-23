/**
 * The colours of the global world art, as named palettes of at most 4 colours per sprite (index 0
 * is digit `0` in the pixel text). Racers, pickups and power-ups carry the brightest, most saturated
 * colours with a near-black outline, so gameplay reads before any theme's scenery. Each racer's
 * main colour holds 3:1 off every theme's contrast bands (`Theme.contrastBands`). The eight
 * characters' palettes live with their sprites in `sprites/racers.ts` (`CharacterPalette`); shape,
 * not brightness, tells them apart. A theme's own colours live in its folder under `themes/`.
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

/** HUD sprite palettes. The progress markers reuse each racer's main colour with a dark outline. */
export const HudPalette = {
  markerPip: [0x0a0a14, RacerPalette.pip[1], RacerPalette.pip[2]],
  markerTess: [0x0a0a14, RacerPalette.tess[1], RacerPalette.tess[2]],
  markerSquib: [0x0a0a14, RacerPalette.squib[1], RacerPalette.squib[2]],
  markerBo: [0x0a0a14, RacerPalette.bo[3], 0xffb08a],
  /** Kick pip: outline, ready glow, ready core. Cooling uses the outline only, so state reads by shape too. */
  kickPip: [0x2a4a6a, 0x7fdbff, 0xe0f8ff],
} as const satisfies Record<string, Palette>;
