/**
 * Reef's hazards: a spiny urchin and a pulsing jellyfish, with their texture and loop keys. Both are
 * dark-outlined with sharp, stinging shapes, so they read as dangerous by silhouette and not by
 * colour alone. The keys carry no world prefix, like the rest of Reef's.
 */
import type { AnimLoop } from '../../../art/index.ts';
import { Frame } from '../../../art/keys.ts';
import type { Palette } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';

/** Reef hazard texture keys. */
export const ReefHazardTex = {
  urchin: 'urchin',
  /** The jellyfish: frames `a` and `b`, looped by `ReefHazardAnim.jellyPulse`. */
  jelly: 'jelly',
} as const;

/** Reef hazard animation keys. */
export const ReefHazardAnim = {
  jellyPulse: 'jelly-pulse',
} as const;

/** Hazard palettes: dark bodies with hot accents, so danger reads by shape and value, not hue alone. */
export const ReefHazardPalette = {
  /** Urchin: near-black spines and core, a lit lilac body that holds 3:1 in deep water, spine tips. */
  urchin: [0x0c0414, 0xc488f0, 0xff5a7a],
  /** Jellyfish: outline, bell, light bell, stinging tentacles. */
  jelly: [0x6a1a5c, 0xff70c4, 0xffc8ec, 0xffe0f4],
} as const satisfies Record<string, Palette>;

/** The jelly pulses on Phaser's clock, never on logic ticks. */
export const REEF_HAZARD_LOOPS: readonly AnimLoop[] = [
  { key: ReefHazardAnim.jellyPulse, texture: ReefHazardTex.jelly, frameRate: 3 },
];

/** Hazard sheets. The jelly's `a` frame is the open bell, `b` the squeezed one. */
export const REEF_HAZARD_SHEETS: readonly ArtSheet<string>[] = [
  sheet(ReefHazardTex.urchin, ReefHazardPalette.urchin, {
    [Frame.a]: [
      '2....2....2.',
      '.0...0...0..',
      '..0.000.0...',
      '...011110...',
      '..01211110..',
      '200121111002',
      '..01111110..',
      '...011110...',
      '..0.000.0...',
      '.0...0...0..',
      '2....0....2.',
      '.....2......',
    ],
  }),
  sheet(ReefHazardTex.jelly, ReefHazardPalette.jelly, {
    [Frame.a]: [
      '..00111100..',
      '.0111111110.',
      '011221111110',
      '011211111110',
      '011111111110',
      '011111111110',
      '.0000000000.',
      '.3..3..3..3.',
      '3..3..3..3..',
      '.3..3..3..3.',
      '3..3..3..3..',
      '.3.....3....',
      '3.......3...',
      '............',
    ],
    [Frame.b]: [
      '...011110...',
      '..01111110..',
      '.0112211110.',
      '.0112111110.',
      '.0111111110.',
      '.0111111110.',
      '.0111111110.',
      '..00000000..',
      '..3.3.3.3...',
      '..3.3.3.3...',
      '...3.3.3....',
      '...3.3.3....',
      '..3.3.3.3...',
      '....3.3.....',
    ],
  }),
];
