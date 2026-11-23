/**
 * The space look: Farside's earth, branches, canopy and light. Its art, keys and colours live in
 * `space/`; this file says how the views use them. Air barely slows particles, so dust and leaves
 * rise slowly, debris falls fast and a splash is a short burst of dust.
 */

import { drawSheets, registerLoops } from '../art/index.ts';
import { Frame } from '../art/keys.ts';
import { FxFrame } from '../fx/textures.ts';
import { defineTheme } from './define.ts';
import { SpaceAnim, SpaceTex, SpaceTile } from './space/keys.ts';
import { SpaceBackdropPalette, StarLight, VOID_BANDS } from './space/palettes.ts';
import { SPACE_SHEETS } from './space/sprites/index.ts';
import type { ContrastBand } from './types.ts';

/** Mud bubbles, wind and wasp wings animate on Phaser's clock, never on logic ticks. */
const SPACE_LOOPS = [
  { key: SpaceAnim.mudBubble, texture: SpaceTex.mud, frameRate: 2 },
  { key: SpaceAnim.windRight, texture: SpaceTex.windRight, frameRate: 4 },
  { key: SpaceAnim.windLeft, texture: SpaceTex.windLeft, frameRate: 4 },
  { key: SpaceAnim.windUp, texture: SpaceTex.windUp, frameRate: 4 },
  { key: SpaceAnim.windDown, texture: SpaceTex.windDown, frameRate: 4 },
  { key: SpaceAnim.waspBuzz, texture: SpaceTex.wasp, frameRate: 12 },
] as const;

/** Every canopy band and backdrop layer colour: everything a racer or off-panel text can sit in front of. */
const SPACE_CONTRAST_BANDS: readonly ContrastBand[] = [
  ...VOID_BANDS.map((colour, band) => ({ name: `canopy band ${band}`, colour })),
  ...SpaceBackdropPalette.far.map((colour, index) => ({ name: `far trees ${index}`, colour })),
  ...SpaceBackdropPalette.near.map((colour, index) => ({ name: `near trunks ${index}`, colour })),
];

/** The space theme. */
export const SPACE_THEME = defineTheme({
  id: 'space',
  registerTextures(scene) {
    drawSheets(scene, SPACE_SHEETS, 'space');
    registerLoops(scene, SPACE_LOOPS, 'space');
  },
  terrain: {
    tileset: SpaceTex.tiles,
    tiles: { rock: SpaceTile.rock, coral: SpaceTile.coral, ledge: SpaceTile.ledge },
    buriedTiles: { rock: SpaceTile.rockBuried },
    flowing: {
      kelp: { texture: SpaceTex.mud, anim: SpaceAnim.mudBubble },
      'current-right': { texture: SpaceTex.windRight, anim: SpaceAnim.windRight },
      'current-left': { texture: SpaceTex.windLeft, anim: SpaceAnim.windLeft },
      'current-up': { texture: SpaceTex.windUp, anim: SpaceAnim.windUp },
      'current-down': { texture: SpaceTex.windDown, anim: SpaceAnim.windDown },
    },
    finishGate: SpaceTex.finishGate,
    debris: SpaceTex.stoneDebris,
  },
  backdrop: {
    bands: VOID_BANDS,
    layers: [
      { texture: SpaceTex.backdropFar, height: 64, factor: 0.15, aboveRays: false },
      { texture: SpaceTex.backdropNear, height: 80, factor: 0.35, aboveRays: true },
    ],
    caustics: StarLight.dapple,
    rays: StarLight.ray,
  },
  ambient: { motes: StarLight.mote },
  particles: {
    rise: { drag: 0.97, ay: -0.012, wobble: 1 },
    riseStill: { drag: 0.95, ay: -0.004, wobble: 0 },
    fall: { drag: 0.99, ay: 0.09, wobble: 0 },
    fallStill: { drag: 0.97, ay: 0.02, wobble: 0 },
    drift: { drag: 0.95, ay: 0, wobble: 0 },
    splash: { drag: 0.9, ay: 0.02, wobble: 0 },
  },
  hazards: {
    urchin: { texture: SpaceTex.thornBush, frame: Frame.a, anim: null },
    jelly: { texture: SpaceTex.wasp, frame: Frame.a, anim: SpaceAnim.waspBuzz },
  },
  // The root cave's own green taken almost to black.
  dark: { colour: 0x020a06, alpha: 0.9 },
  trail: { frame: FxFrame.chip, tint: 0x8a6a48, alpha: 0.5 },
  contrastBands: SPACE_CONTRAST_BANDS,
});
