/**
 * The forest look: Thornwood's earth, branches, canopy and light. Its art, keys and colours live in
 * `forest/`; this file says how the views use them. Air barely slows particles, so dust and leaves
 * rise slowly, debris falls fast and a splash is a short burst of dust.
 */

import { drawSheets, registerLoops } from '../art/index.ts';
import { Frame } from '../art/keys.ts';
import { FxFrame } from '../fx/textures.ts';
import { defineTheme } from './define.ts';
import { ForestAnim, ForestTex, ForestTile } from './forest/keys.ts';
import { CanopyLight, ForestBackdropPalette, WOOD_BANDS } from './forest/palettes.ts';
import { FOREST_SHEETS } from './forest/sprites/index.ts';
import type { ContrastBand } from './types.ts';

/** Mud bubbles, wind and wasp wings animate on Phaser's clock, never on logic ticks. */
const FOREST_LOOPS = [
  { key: ForestAnim.mudBubble, texture: ForestTex.mud, frameRate: 2 },
  { key: ForestAnim.windRight, texture: ForestTex.windRight, frameRate: 4 },
  { key: ForestAnim.windLeft, texture: ForestTex.windLeft, frameRate: 4 },
  { key: ForestAnim.windUp, texture: ForestTex.windUp, frameRate: 4 },
  { key: ForestAnim.windDown, texture: ForestTex.windDown, frameRate: 4 },
  { key: ForestAnim.waspBuzz, texture: ForestTex.wasp, frameRate: 12 },
] as const;

/** Every canopy band and backdrop layer colour: everything a racer or off-panel text can sit in front of. */
const FOREST_CONTRAST_BANDS: readonly ContrastBand[] = [
  ...WOOD_BANDS.map((colour, band) => ({ name: `canopy band ${band}`, colour })),
  ...ForestBackdropPalette.far.map((colour, index) => ({ name: `far trees ${index}`, colour })),
  ...ForestBackdropPalette.near.map((colour, index) => ({ name: `near trunks ${index}`, colour })),
];

/** The forest theme. */
export const FOREST_THEME = defineTheme({
  id: 'forest',
  registerTextures(scene) {
    drawSheets(scene, FOREST_SHEETS, 'forest');
    registerLoops(scene, FOREST_LOOPS, 'forest');
  },
  terrain: {
    tileset: ForestTex.tiles,
    tiles: { rock: ForestTile.rock, coral: ForestTile.coral, ledge: ForestTile.ledge },
    flowing: {
      kelp: { texture: ForestTex.mud, anim: ForestAnim.mudBubble },
      'current-right': { texture: ForestTex.windRight, anim: ForestAnim.windRight },
      'current-left': { texture: ForestTex.windLeft, anim: ForestAnim.windLeft },
      'current-up': { texture: ForestTex.windUp, anim: ForestAnim.windUp },
      'current-down': { texture: ForestTex.windDown, anim: ForestAnim.windDown },
    },
    finishGate: ForestTex.finishGate,
    debris: ForestTex.stoneDebris,
  },
  backdrop: {
    bands: WOOD_BANDS,
    layers: [
      { texture: ForestTex.backdropFar, height: 64, factor: 0.15, aboveRays: false },
      { texture: ForestTex.backdropNear, height: 80, factor: 0.35, aboveRays: true },
    ],
    caustics: CanopyLight.dapple,
    rays: CanopyLight.ray,
  },
  ambient: { motes: CanopyLight.mote },
  particles: {
    rise: { drag: 0.97, ay: -0.012, wobble: 1 },
    riseStill: { drag: 0.95, ay: -0.004, wobble: 0 },
    fall: { drag: 0.99, ay: 0.09, wobble: 0 },
    fallStill: { drag: 0.97, ay: 0.02, wobble: 0 },
    drift: { drag: 0.95, ay: 0, wobble: 0 },
    splash: { drag: 0.9, ay: 0.02, wobble: 0 },
  },
  hazards: {
    urchin: { texture: ForestTex.thornBush, frame: Frame.a, anim: null },
    jelly: { texture: ForestTex.wasp, frame: Frame.a, anim: ForestAnim.waspBuzz },
  },
  // The root cave's own green taken almost to black.
  dark: { colour: 0x020a06, alpha: 0.9 },
  trail: { frame: FxFrame.chip, tint: 0x8a6a48, alpha: 0.5 },
  contrastBands: FOREST_CONTRAST_BANDS,
});
