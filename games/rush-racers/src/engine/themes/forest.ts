/**
 * The forest look: Thornwood's earth, branches, canopy and light. Its art, keys and colours live in
 * `forest/`; this file says how the views use them. Air barely slows particles, so dust and leaves
 * rise slowly, debris falls fast and a splash is a short burst of dust. Its extra layers draw
 * Thornwood's rolling Boulders (`view/boulder-view.ts`) and its Mud Pies and their mud patches
 * (`view/mud-pie-view.ts`), and crumbling branches (`view/set-pieces/crumble-view.ts`).
 */

import { FxFrame } from '../fx/textures.ts';
import { createBoulderView } from '../view/boulder-view.ts';
import { createMudPieView } from '../view/mud-pie-view.ts';
import { createCrumbleView } from '../view/set-pieces/crumble-view.ts';
import { defineTheme } from './define.ts';
import { ForestAnim, ForestTex, ForestTile } from './forest/keys.ts';
import { CanopyLight, ForestBackdropPalette, WOOD_BANDS } from './forest/palettes.ts';
import type { ContrastBand } from './types.ts';

/** Every canopy band and backdrop layer colour: everything a racer or off-panel text can sit in front of. */
const FOREST_CONTRAST_BANDS: readonly ContrastBand[] = [
  ...WOOD_BANDS.map((colour, band) => ({ name: `canopy band ${band}`, colour })),
  ...ForestBackdropPalette.far.map((colour, index) => ({ name: `far trees ${index}`, colour })),
  ...ForestBackdropPalette.near.map((colour, index) => ({ name: `near trunks ${index}`, colour })),
];

/** The forest theme. */
export const FOREST_THEME = defineTheme({
  id: 'forest',
  terrain: {
    tileset: ForestTex.tiles,
    tiles: { rock: ForestTile.rock, coral: ForestTile.coral, ledge: ForestTile.ledge, bounce: ForestTile.bounce },
    buriedTiles: { rock: ForestTile.rockBuried },
    glyphTiles: {
      streamStone: ForestTile.streamStone,
      oakBark: ForestTile.oakBark,
      knotRim: ForestTile.knotRim,
      rottenWood: ForestTile.rottenWood,
      ropePost: ForestTile.ropePost,
    },
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
  // The root cave's own green taken almost to black.
  dark: { colour: 0x020a06, alpha: 0.9 },
  trail: { frame: FxFrame.chip, tint: 0x8a6a48, alpha: 0.5 },
  contrastBands: FOREST_CONTRAST_BANDS,
  extraLayers: (scene, world, reducedMotion) => [
    createBoulderView(scene, world),
    createMudPieView(scene, reducedMotion),
    createCrumbleView(scene, world, reducedMotion),
  ],
});
