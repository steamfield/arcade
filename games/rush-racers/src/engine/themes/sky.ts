/**
 * The sky look: Cloudreach's thunderheads, puff, bounce and fog clouds, wind, cloud banks and a sky
 * at dusk. Its art, keys and colours live in `sky/`; this file says how the views use them. There is
 * no open-sky tile: air shows the backdrop's bands, evening haze, cloud banks and setting sun. Air
 * barely slows particles and nothing in it floats up, so a contrail and kick puffs hang where they
 * were left and a popped cloud's puffs drift down, swaying.
 */

import { FxFrame } from '../fx/textures.ts';
import { defineTheme } from './define.ts';
import { SkyThemeAnim, SkyThemeTex, SkyThemeTile } from './sky/keys.ts';
import { EVENING_HAZE, SKY_BANDS, SkyBackdropPalette, STORM_TINT } from './sky/palettes.ts';
import type { BubbleFrames, ContrastBand, HazeSpec } from './types.ts';

/** The evening haze streaked across the bands. */
const HAZE: HazeSpec = { colour: EVENING_HAZE, alpha: 0.35 };

/** `under` seen through `over` drawn at `alpha`, blended channel by channel as the renderer does. */
function blend(under: number, over: number, alpha: number): number {
  return [16, 8, 0].reduce((colour, shift) => {
    const mixed = Math.round(((under >> shift) & 0xff) * (1 - alpha) + ((over >> shift) & 0xff) * alpha);
    return colour | (mixed << shift);
  }, 0);
}

/**
 * Every colour a racer or off-panel text can sit in front of: each sky band, each band seen through a
 * haze streak, and the cloud banks and sun.
 */
const SKY_CONTRAST_BANDS: readonly ContrastBand[] = [
  ...SKY_BANDS.map((colour, band) => ({ name: `sky band ${band}`, colour })),
  ...SKY_BANDS.map((colour, band) => ({
    name: `haze over sky band ${band}`,
    colour: blend(colour, HAZE.colour, HAZE.alpha),
  })),
  ...SkyBackdropPalette.far.map((colour, index) => ({ name: `far clouds ${index}`, colour })),
  ...SkyBackdropPalette.near.map((colour, index) => ({ name: `near clouds ${index}`, colour })),
];

/** A contrail: small round white puffs, half see-through, left behind every moving racer. */
const CONTRAIL = { frame: FxFrame.puff, tint: 0xf4f8ff, alpha: 0.5 } as const;

/** Kick puffs, popped-cloud rings and the finish burst are puffs of vapour, not bubbles. */
const VAPOUR: BubbleFrames = { large: FxFrame.puff, small: FxFrame.puff };

/** Opacity of the storm veil over a dark stretch. */
const STORM_VEIL_ALPHA = 0.85;

/** The sky theme. */
export const SKY_THEME = defineTheme({
  id: 'sky',
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
    rays: null,
    haze: HAZE,
  },
  ambient: { motes: null },
  particles: {
    rise: { drag: 0.98, ay: 0, wobble: 1 },
    riseStill: { drag: 0.96, ay: 0, wobble: 0 },
    fall: { drag: 0.98, ay: 0.04, wobble: 1 },
    fallStill: { drag: 0.97, ay: 0.01, wobble: 0 },
    drift: { drag: 0.96, ay: 0, wobble: 0 },
    splash: { drag: 0.92, ay: 0.02, wobble: 0 },
  },
  // Veils the course's dark stretches (`level.dark`); lightning zones are shaded by the lightning view.
  dark: { colour: STORM_TINT, alpha: STORM_VEIL_ALPHA },
  trail: CONTRAIL,
  bubbleFrames: VAPOUR,
  contrastBands: SKY_CONTRAST_BANDS,
  hudOverSky: true,
});
