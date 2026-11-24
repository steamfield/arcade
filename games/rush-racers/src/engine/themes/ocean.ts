/**
 * The ocean look: Sunlit Shallows' reef, water, bubbles and light, the sky and rolling waterline
 * where the sea opens to the air, and cave stone and walls for dark stretches. Its art, keys and
 * colours live in `ocean/`; this file says how the views use them. Water slows particles hard,
 * bubbles rise and sway, and debris sinks. Vents and whirlpools are extra layers.
 */

import { FxFrame } from '../fx/textures.ts';
import { createVentView } from '../view/set-pieces/vent-view.ts';
import { createWhirlpoolView } from '../view/set-pieces/whirlpool-view.ts';
import { defineTheme } from './define.ts';
import { OceanAnim, OceanTex, OceanTile } from './ocean/keys.ts';
import { BackdropPalette, TerrainPalette, WATER_BANDS, WaterLight, WhirlpoolPalette } from './ocean/palettes.ts';
import { OCEAN_VENT_ART } from './ocean/vent-art.ts';
import type { ContrastBand } from './types.ts';

/** Every water band, sky and backdrop colour: everything a racer or off-panel text can sit in front of. */
const OCEAN_CONTRAST_BANDS: readonly ContrastBand[] = [
  ...WATER_BANDS.map((colour, band) => ({ name: `water band ${band}`, colour })),
  ...BackdropPalette.far.map((colour, index) => ({ name: `far reef ${index}`, colour })),
  ...BackdropPalette.near.map((colour, index) => ({ name: `kelp forest ${index}`, colour })),
  ...TerrainPalette.sky.map((colour, index) => ({ name: `sky ${index}`, colour })),
  ...BackdropPalette.caveWall.map((colour, index) => ({ name: `cave wall ${index}`, colour })),
];

/** The ocean theme. */
export const OCEAN_THEME = defineTheme({
  id: 'ocean',
  terrain: {
    tileset: OceanTex.tiles,
    // The bounce cloud lets a course with bounce cells be drawn in the ocean theme.
    tiles: {
      rock: OceanTile.rock,
      coral: OceanTile.coral,
      air: OceanTile.sky,
      ledge: OceanTile.ledge,
      bounce: OceanTile.bounce,
    },
    glyphTiles: {
      caveRock: OceanTile.caveRock,
      stalactite: OceanTile.stalactite,
      stalagmite: OceanTile.stalagmite,
    },
    flowing: {
      kelp: { texture: OceanTex.kelp, anim: OceanAnim.kelpSway },
      'current-right': { texture: OceanTex.currentRight, anim: OceanAnim.currentRight },
      'current-left': { texture: OceanTex.currentLeft, anim: OceanAnim.currentLeft },
      'current-up': { texture: OceanTex.currentUp, anim: OceanAnim.currentUp },
      'current-down': { texture: OceanTex.currentDown, anim: OceanAnim.currentDown },
    },
    surface: { texture: OceanTex.waterline, anim: OceanAnim.waterlineRoll },
    finishGate: OceanTex.finishGate,
    debris: OceanTex.coralDebris,
  },
  backdrop: {
    bands: WATER_BANDS,
    layers: [
      { texture: OceanTex.backdropFar, height: 64, factor: 0.15, aboveRays: false },
      { texture: OceanTex.backdropNear, height: 80, factor: 0.35, aboveRays: true },
    ],
    caustics: WaterLight.caustic,
    rays: WaterLight.ray,
    cave: { texture: OceanTex.caveWall },
  },
  ambient: { motes: WaterLight.mote },
  particles: {
    rise: { drag: 0.92, ay: -0.025, wobble: 1 },
    riseStill: { drag: 0.9, ay: -0.008, wobble: 0 },
    fall: { drag: 0.95, ay: 0.06, wobble: 0 },
    fallStill: { drag: 0.9, ay: 0.01, wobble: 0 },
    drift: { drag: 0.88, ay: 0, wobble: 0 },
    splash: { drag: 0.85, ay: -0.01, wobble: 0 },
  },
  // The deep water's own blue taken almost to black.
  dark: { colour: 0x020616, alpha: 0.9 },
  trail: { frame: FxFrame.bubbleSmall, tint: 0xffffff, alpha: 0.6 },
  contrastBands: OCEAN_CONTRAST_BANDS,
  extraLayers: (scene, world, reducedMotion) => [
    createVentView(scene, world, OCEAN_VENT_ART, reducedMotion),
    createWhirlpoolView(scene, world, WhirlpoolPalette, reducedMotion),
  ],
});
