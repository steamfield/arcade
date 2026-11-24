/**
 * The space look: Farside's asteroid rock, ice, nebula dust, solar wind and starfield, plus its
 * drifting asteroids, wormholes, Comets and gravity bombs as extra layers. Its art, keys
 * and colours live in `space/`; this file says how the views use them. Nothing has weight in a
 * vacuum, so no particle rises or falls: they coast to a stop, and reduced motion only stops them
 * sooner.
 */

import { FxFrame } from '../fx/textures.ts';
import { createCometView } from '../view/comet-view.ts';
import { createGravityBombView } from '../view/gravity-bomb-view.ts';
import { createAsteroidView } from '../view/set-pieces/asteroid-view.ts';
import { createWormholeView } from '../view/set-pieces/wormhole-view.ts';
import { defineTheme } from './define.ts';
import { FAR_HEIGHT, NEAR_HEIGHT, SpaceAnim, SpaceTex, SpaceTile } from './space/keys.ts';
import { SpaceBackdropPalette, StarLight, VOID_BANDS } from './space/palettes.ts';
import type { ContrastBand } from './types.ts';

/**
 * Everything a racer or off-panel text can sit in front of: the seven sky bands and the near moon's
 * shadow and lit edge. The two far starfield colours are drawn nowhere (the far layer is all stars,
 * which are single pixels like the drifting motes, so they aren't bands); they stay in the list only
 * so the contrast tests stay as strict as before.
 */
const SPACE_CONTRAST_BANDS: readonly ContrastBand[] = [
  ...VOID_BANDS.map((colour, band) => ({ name: `sky band ${band}`, colour })),
  ...SpaceBackdropPalette.far.map((colour, index) => ({ name: `far starfield ${index}`, colour })),
  ...SpaceBackdropPalette.near.map((colour, index) => ({ name: `near moon ${index}`, colour })),
];

/** The space theme. */
export const SPACE_THEME = defineTheme({
  id: 'space',
  terrain: {
    tileset: SpaceTex.tiles,
    tiles: { rock: SpaceTile.rock, coral: SpaceTile.coral, ledge: SpaceTile.ledge },
    buriedTiles: { rock: SpaceTile.rockBuried },
    glyphTiles: {
      gasGiant: SpaceTile.gasGiant,
      debrisShield: SpaceTile.debrisShield,
      archCrown: SpaceTile.archCrown,
      archShoulderLeft: SpaceTile.archShoulderLeft,
      archShoulderRight: SpaceTile.archShoulderRight,
      archPillarLeft: SpaceTile.archPillarLeft,
      archPillarRight: SpaceTile.archPillarRight,
    },
    flowing: {
      kelp: { texture: SpaceTex.dust, anim: SpaceAnim.dustSwirl },
      'current-right': { texture: SpaceTex.windRight, anim: SpaceAnim.windRight },
      'current-left': { texture: SpaceTex.windLeft, anim: SpaceAnim.windLeft },
      'current-up': { texture: SpaceTex.windUp, anim: SpaceAnim.windUp },
      'current-down': { texture: SpaceTex.windDown, anim: SpaceAnim.windDown },
    },
    finishGate: SpaceTex.finishGate,
    debris: SpaceTex.iceDebris,
  },
  backdrop: {
    bands: VOID_BANDS,
    layers: [
      { texture: SpaceTex.backdropFar, height: FAR_HEIGHT, factor: 0.15, aboveRays: false },
      { texture: SpaceTex.backdropNear, height: NEAR_HEIGHT, factor: 0.35, aboveRays: true },
    ],
    // No air to shimmer in or scatter light, so no caustics and no light shafts.
    caustics: null,
    rays: null,
  },
  ambient: { motes: StarLight.mote },
  particles: {
    rise: { drag: 0.97, ay: 0, wobble: 1 },
    riseStill: { drag: 0.93, ay: 0, wobble: 0 },
    // Broken ice chips: with no gravity to stop them, drag alone brings them to rest within 5-20 px.
    fall: { drag: 0.92, ay: 0, wobble: 0 },
    fallStill: { drag: 0.95, ay: 0, wobble: 0 },
    drift: { drag: 0.97, ay: 0, wobble: 0 },
    splash: { drag: 0.9, ay: 0, wobble: 0 },
  },
  // The moon's shadow: the sky's own blue taken almost to black.
  dark: { colour: 0x020208, alpha: 0.9 },
  // Thruster exhaust: pale blue specks.
  trail: { frame: FxFrame.chip, tint: 0x9fc8ff, alpha: 0.45 },
  contrastBands: SPACE_CONTRAST_BANDS,
  extraLayers: (scene, world, reducedMotion) => [
    createAsteroidView(scene, world),
    createWormholeView(scene, world, reducedMotion),
    createCometView(scene),
    createGravityBombView(scene, reducedMotion),
  ],
});
