/**
 * Thornwood's hazards: a thorn bush (the urchin's slot) and a buzzing wasp (the jelly's slot), with
 * their texture and loop keys. Both are dark-outlined with sharp, stinging shapes, so they read as
 * dangerous by silhouette and not by colour alone. The keys keep the `forest-` prefix they were
 * first drawn under, so existing captures and baselines don't change.
 */
import type { AnimLoop } from '../../../art/index.ts';
import { Frame } from '../../../art/keys.ts';
import type { Palette } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';

/** Thornwood hazard texture keys. */
export const ThornHazardTex = {
  thornBush: 'forest-thorn-bush',
  /** The wasp: frames `a` and `b`, looped by `ThornHazardAnim.waspBuzz`. */
  wasp: 'forest-wasp',
} as const;

/** Thornwood hazard animation keys. */
export const ThornHazardAnim = {
  waspBuzz: 'forest-wasp-buzz',
} as const;

/** Hazard palettes: dark bodies with hot accents, so danger reads by shape and value, not hue alone. */
export const ThornHazardPalette = {
  /** Thorn bush: near-black stems, a lit pink body that holds 3:1 off the lightest canopy band, thorn tips. */
  thornBush: [0x140810, 0xe888b0, 0xffd0a0],
  /** Wasp: outline, yellow body, black stripes and wing shine. */
  wasp: [0x1a1206, 0xffd23a, 0x2a2010, 0xe8f4ff],
} as const satisfies Record<string, Palette>;

/** The wasp's wings beat on Phaser's clock, never on logic ticks. */
export const THORN_HAZARD_LOOPS: readonly AnimLoop[] = [
  { key: ThornHazardAnim.waspBuzz, texture: ThornHazardTex.wasp, frameRate: 12 },
];

/** Hazard sheets. The wasp's `a` frame has its wings up, `b` has them down. */
export const THORN_HAZARD_SHEETS: readonly ArtSheet<string>[] = [
  sheet(ThornHazardTex.thornBush, ThornHazardPalette.thornBush, {
    [Frame.a]: [
      '.2...2..2...',
      '.0..0.0.0.2.',
      '20.0.000.0..',
      '.0011111100.',
      '.0112111110.',
      '200111111002',
      '.0111111110.',
      '..011121110.',
      '.0.0011110.2',
      '2.0.0000.0..',
      '..2.0..0.2..',
      '.....22.....',
    ],
  }),
  sheet(ThornHazardTex.wasp, ThornHazardPalette.wasp, {
    [Frame.a]: [
      '...3....3...',
      '..33....33..',
      '..3.0000.3..',
      '...0111100..',
      '..012212100.',
      '..01221210..',
      '...0111100..',
      '...0122120..',
      '....01110...',
      '.....010....',
      '......0.....',
      '............',
      '............',
      '............',
    ],
    [Frame.b]: [
      '............',
      '............',
      '....0000....',
      '...0111100..',
      '.3.012212100',
      '33.01221210.',
      '3..0111100..',
      '...0122120..',
      '....01110...',
      '.....010....',
      '......0.....',
      '..3.....3...',
      '..33...33...',
      '...3...3....',
    ],
  }),
];
