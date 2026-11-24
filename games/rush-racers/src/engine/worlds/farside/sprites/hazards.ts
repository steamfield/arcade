/**
 * Farside's hazards: a space mine (the urchin's slot) and a plasma orb (the jelly's slot), with their
 * texture and loop keys. Both are dark-outlined, so they read as dangerous by silhouette and not by
 * colour alone: the mine by its eight spikes, the orb by the sparks it throws. The keys keep the
 * `space-` prefix they were first drawn under, so existing captures and baselines don't change.
 */
import type { AnimLoop } from '../../../art/index.ts';
import { Frame } from '../../../art/keys.ts';
import type { Palette } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';

/** Farside hazard texture keys. */
export const FarHazardTex = {
  mine: 'space-mine',
  /** The plasma orb: frames `a` and `b`, looped by `FarHazardAnim.orbPulse`. */
  orb: 'space-orb',
} as const;

/** Farside hazard animation keys. */
export const FarHazardAnim = {
  orbPulse: 'space-orb-pulse',
} as const;

/** Hazard palettes: dark bodies with hot accents, so danger reads by shape and value, not hue alone. */
export const FarHazardPalette = {
  /** Space mine: near-black rivets, a lit pink body that holds 3:1 off the lightest sky band, spike tips. */
  mine: [0x140810, 0xe888b0, 0xffd0a0],
  /** Plasma orb: outline, yellow body, dark core band and white-hot shine. */
  orb: [0x1a1206, 0xffd23a, 0x2a2010, 0xe8f4ff],
} as const satisfies Record<string, Palette>;

/** The orb pulses on Phaser's clock, never on logic ticks. */
export const FAR_HAZARD_LOOPS: readonly AnimLoop[] = [
  { key: FarHazardAnim.orbPulse, texture: FarHazardTex.orb, frameRate: 4 },
];

/**
 * The space mine: a riveted round body with a spike at every compass point, each a shaft of the body
 * colour ending in a hot tip. The dark outline runs only round the body, so the spikes read bright. Still.
 */
const MINE_ROWS = [
  '.....22.....',
  '.2...11...2.',
  '..1.0110.1..',
  '...011110...',
  '..01101110..',
  '211111111112',
  '211111111112',
  '..01110110..',
  '...011110...',
  '..1.0110.1..',
  '.2...11...2.',
  '.....22.....',
];

/** The plasma orb drawn in: a small glowing ball, white-hot at its upper left, with sparks close by. */
const ORB_IN_ROWS = [
  '............',
  '.....3......',
  '............',
  '....0000....',
  '...011110...',
  '..01331110..',
  '3.01311110..',
  '..01111110.3',
  '..01111210..',
  '...011220...',
  '....0000....',
  '............',
  '......3.....',
  '............',
];

/** The plasma orb swelled out: the same ball two pixels wider, its sparks thrown to the corners. */
const ORB_OUT_ROWS = [
  '..3......3..',
  '............',
  '...000000...',
  '..01111110..',
  '.0113311110.',
  '.0133111110.',
  '.0131111110.',
  '.0111111110.',
  '.0111111210.',
  '.0111112210.',
  '..01122210..',
  '...000000...',
  '............',
  '..3......3..',
];

/** Hazard sheets. The orb pulses between its drawn-in `a` frame and its swelled `b` frame. */
export const FAR_HAZARD_SHEETS: readonly ArtSheet<string>[] = [
  sheet(FarHazardTex.mine, FarHazardPalette.mine, { [Frame.a]: MINE_ROWS }),
  sheet(FarHazardTex.orb, FarHazardPalette.orb, { [Frame.a]: ORB_IN_ROWS, [Frame.b]: ORB_OUT_ROWS }),
];
