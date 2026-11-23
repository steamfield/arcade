/**
 * The effects' own particle sprites: small bubbles, a chip, a spark, a sparkle and a puff, authored
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
} as const;

const BUBBLE_PALETTE = [0x9ad8ff, 0xffffff];
const WHITE_PALETTE = [0xffffff, 0xffffff];
const SPARK_PALETTE = [0xffe890, 0xffffff];

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
];

/**
 * Draws the particle sheet unless an earlier race already did; textures are global to the game.
 *
 * @throws {Error} When the pixel text above is malformed (see `drawFrames`).
 */
export function ensureFxTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(FX_TEXTURE)) drawFrames(scene, FX_TEXTURE, FRAMES);
}
