/**
 * The sky look: Cloudreach's thunderheads, puff, bounce and fog clouds, wind, cloud banks and low
 * golden sunlight. Its art, keys and colours live in `sky/`; this file says how the views use them.
 * There is no open-sky tile: air shows the backdrop's bands, banks and sun shafts. Air barely slows
 * particles, so a contrail hangs and rises slowly and a popped cloud's puffs drift down, swaying.
 */

import { drawSheets, registerLoops } from '../art/index.ts';
import { Frame } from '../art/keys.ts';
import { FxFrame } from '../fx/textures.ts';
import { defineTheme } from './define.ts';
import { SkyThemeAnim, SkyThemeTex, SkyThemeTile } from './sky/keys.ts';
import { SKY_BANDS, SkyBackdropPalette, STORM_TINT, SunLight } from './sky/palettes.ts';
import { SKY_SHEETS } from './sky/sprites/index.ts';
import type { ContrastBand } from './types.ts';

/** Fog drifts, winds flow and the hazards crackle on Phaser's clock, never on logic ticks. */
const SKY_LOOPS = [
  { key: SkyThemeAnim.fogDrift, texture: SkyThemeTex.fog, frameRate: 2 },
  { key: SkyThemeAnim.windRight, texture: SkyThemeTex.windRight, frameRate: 4 },
  { key: SkyThemeAnim.windLeft, texture: SkyThemeTex.windLeft, frameRate: 4 },
  { key: SkyThemeAnim.updraft, texture: SkyThemeTex.updraft, frameRate: 4 },
  { key: SkyThemeAnim.downdraft, texture: SkyThemeTex.downdraft, frameRate: 4 },
  // Three a second at most: the spark cloud's bright sparks are a flash (UI.md).
  { key: SkyThemeAnim.sparkCrackle, texture: SkyThemeTex.sparkCloud, frameRate: 3 },
  { key: SkyThemeAnim.wispFlicker, texture: SkyThemeTex.staticWisp, frameRate: 3 },
] as const;

/** Every sky band and cloud bank colour: everything a racer or off-panel text can sit in front of. */
const SKY_CONTRAST_BANDS: readonly ContrastBand[] = [
  ...SKY_BANDS.map((colour, band) => ({ name: `sky band ${band}`, colour })),
  ...SkyBackdropPalette.far.map((colour, index) => ({ name: `far clouds ${index}`, colour })),
  ...SkyBackdropPalette.near.map((colour, index) => ({ name: `near clouds ${index}`, colour })),
];

/** A contrail: small white puffs, half see-through, left behind every moving racer. */
const CONTRAIL = { frame: FxFrame.chip, tint: 0xf4f8ff, alpha: 0.5 } as const;

/** Opacity of the storm cell's veil over a dark zone. */
const STORM_VEIL_ALPHA = 0.85;

/** The sky theme. */
export const SKY_THEME = defineTheme({
  id: 'sky',
  registerTextures(scene) {
    drawSheets(scene, SKY_SHEETS, 'sky');
    registerLoops(scene, SKY_LOOPS, 'sky');
  },
  terrain: {
    tileset: SkyThemeTex.tiles,
    tiles: {
      rock: SkyThemeTile.rock,
      coral: SkyThemeTile.coral,
      ledge: SkyThemeTile.ledge,
      bounce: SkyThemeTile.bounce,
    },
    buriedTiles: { rock: SkyThemeTile.rockBuried },
    flowing: {
      kelp: { texture: SkyThemeTex.fog, anim: SkyThemeAnim.fogDrift },
      'current-right': { texture: SkyThemeTex.windRight, anim: SkyThemeAnim.windRight },
      'current-left': { texture: SkyThemeTex.windLeft, anim: SkyThemeAnim.windLeft },
      'current-up': { texture: SkyThemeTex.updraft, anim: SkyThemeAnim.updraft },
      'current-down': { texture: SkyThemeTex.downdraft, anim: SkyThemeAnim.downdraft },
    },
    finishGate: SkyThemeTex.finishGate,
    debris: SkyThemeTex.puffDebris,
  },
  backdrop: {
    bands: SKY_BANDS,
    layers: [
      { texture: SkyThemeTex.backdropFar, height: 64, factor: 0.15, aboveRays: false },
      { texture: SkyThemeTex.backdropNear, height: 80, factor: 0.35, aboveRays: true },
    ],
    caustics: null,
    rays: SunLight.ray,
  },
  ambient: { motes: SunLight.mote },
  particles: {
    rise: { drag: 0.98, ay: -0.01, wobble: 1 },
    riseStill: { drag: 0.96, ay: -0.003, wobble: 0 },
    fall: { drag: 0.98, ay: 0.04, wobble: 1 },
    fallStill: { drag: 0.97, ay: 0.01, wobble: 0 },
    drift: { drag: 0.96, ay: 0, wobble: 0 },
    splash: { drag: 0.92, ay: 0.02, wobble: 0 },
  },
  hazards: {
    urchin: { texture: SkyThemeTex.sparkCloud, frame: Frame.a, anim: SkyThemeAnim.sparkCrackle },
    jelly: { texture: SkyThemeTex.staticWisp, frame: Frame.a, anim: SkyThemeAnim.wispFlicker },
  },
  dark: { colour: STORM_TINT, alpha: STORM_VEIL_ALPHA },
  trail: CONTRAIL,
  contrastBands: SKY_CONTRAST_BANDS,
});
