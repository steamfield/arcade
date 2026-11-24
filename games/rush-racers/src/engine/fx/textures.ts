/**
 * The effects' own particle sprites: small bubbles, a chip, a spark, a sparkle, a puff, and the
 * shapes item and movement effects give each world (a leaf, a feather, a flame, a shard, a streak
 * and a thorn), authored
 * as palette-indexed pixel text like the rest of the art and drawn into one texture the first
 * time a race builds its effects. Each frame is 7x7 so every shape has a true centre pixel.
 * Shapes are near-white so a tint can colour them; the bubbles carry their own rim colour.
 */
import type Phaser from 'phaser';
import { drawFrames, type NamedFrame } from '../art/pixel.ts';

/** Texture key for the particle sheet. */
export const FX_TEXTURE = 'fx-particles';

/** Frame names inside `FX_TEXTURE`. */
export const FxFrame = {
  /** A 5 px bubble with a shine pixel. */
  bubble: 'bubble',
  /** A 3 px bubble ring. */
  bubbleSmall: 'bubble-small',
  /** A 3 px plus: ink and grit. */
  chip: 'chip',
  /** A 5 px star with a bright centre: hits. */
  spark: 'spark',
  /** A 3 px diagonal cross with a bright centre: pearls, pickups, place gains. */
  sparkle: 'sparkle',
  /** A filled 3 px square: a puff of cloud or vapour, such as a contrail. */
  puff: 'puff',
  /** A 3 px leaf with a vein pixel: Thornwood's puffs. */
  leaf: 'leaf',
  /** A 5 px diagonal quill: Cloudreach's flaps and wisps. */
  feather: 'feather',
  /** A 5 px tongue of flame with a hot core: Jet Fins, thrusters. */
  flame: 'flame',
  /** A 3 px wedge with a bright edge: a shield breaking. */
  shard: 'shard',
  /** A 5 px horizontal line with a bright head: speed lines, lanes, pulls. */
  streak: 'streak',
  /** A 5 px X with a bright centre: urchin spikes and Puffer barbs. */
  thorn: 'thorn',
} as const;

const BUBBLE_PALETTE = [0x9ad8ff, 0xffffff];
const WHITE_PALETTE = [0xffffff, 0xffffff];
const SPARK_PALETTE = [0xffe890, 0xffffff];
/** Light grey with a white highlight, so a tint shows the body a shade darker than its bright pixel. */
const SHADE_PALETTE = [0xd8d8d8, 0xffffff];

const FRAMES: readonly NamedFrame[] = [
  {
    name: FxFrame.bubble,
    palette: BUBBLE_PALETTE,
    rows: ['.......', '..000..', '.01..0.', '.0...0.', '.0...0.', '..000..', '.......'],
  },
  {
    name: FxFrame.bubbleSmall,
    palette: BUBBLE_PALETTE,
    rows: ['.......', '.......', '...0...', '..0.0..', '...0...', '.......', '.......'],
  },
  {
    name: FxFrame.chip,
    palette: WHITE_PALETTE,
    rows: ['.......', '.......', '...0...', '..000..', '...0...', '.......', '.......'],
  },
  {
    name: FxFrame.spark,
    palette: SPARK_PALETTE,
    rows: ['.......', '...0...', '...0...', '.00100.', '...0...', '...0...', '.......'],
  },
  {
    name: FxFrame.sparkle,
    palette: WHITE_PALETTE,
    rows: ['.......', '.......', '..0.0..', '...1...', '..0.0..', '.......', '.......'],
  },
  {
    name: FxFrame.puff,
    palette: WHITE_PALETTE,
    rows: ['.......', '.......', '..000..', '..000..', '..000..', '.......', '.......'],
  },
  {
    name: FxFrame.leaf,
    palette: SHADE_PALETTE,
    rows: ['.......', '.......', '...00..', '..010..', '..00...', '.......', '.......'],
  },
  {
    name: FxFrame.feather,
    palette: SHADE_PALETTE,
    rows: ['.......', '.....0.', '....00.', '...01..', '..00...', '.0.....', '.......'],
  },
  {
    name: FxFrame.flame,
    palette: SHADE_PALETTE,
    rows: ['.......', '...0...', '..000..', '.00100.', '..000..', '.......', '.......'],
  },
  {
    name: FxFrame.shard,
    palette: SHADE_PALETTE,
    rows: ['.......', '.......', '..1....', '..01...', '..000..', '.......', '.......'],
  },
  {
    name: FxFrame.streak,
    palette: SHADE_PALETTE,
    rows: ['.......', '.......', '.......', '.00001.', '.......', '.......', '.......'],
  },
  {
    name: FxFrame.thorn,
    palette: SHADE_PALETTE,
    rows: ['.......', '.0...0.', '..0.0..', '...1...', '..0.0..', '.0...0.', '.......'],
  },
];

/**
 * Draws the particle sheet unless an earlier race already did; textures are global to the game.
 *
 * @throws {Error} When the pixel text above is malformed (see `drawFrames`).
 */
export function ensureFxTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(FX_TEXTURE)) drawFrames(scene, FX_TEXTURE, FRAMES);
}
