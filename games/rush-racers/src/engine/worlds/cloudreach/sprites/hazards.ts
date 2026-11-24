/**
 * Cloudreach's hazards: a spark cloud (the urchin's slot) and a static wisp (the jelly's slot), with
 * their texture and loop keys. Both are dark-outlined with a bright body and a crackle that moves
 * between their two frames, so they read as dangerous by shape and motion, not by colour alone. The
 * keys keep the `sky-theme-` prefix they were first drawn under, so existing captures and baselines
 * don't change.
 */
import type { AnimLoop } from '../../../art/index.ts';
import { Frame } from '../../../art/keys.ts';
import type { Palette } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';

/** Cloudreach hazard texture keys; each has frames `a` and `b`, looped by `SkyHazardAnim`. */
export const SkyHazardTex = {
  sparkCloud: 'sky-theme-spark-cloud',
  staticWisp: 'sky-theme-static-wisp',
} as const;

/** Cloudreach hazard animation keys. */
export const SkyHazardAnim = {
  sparkCrackle: 'sky-theme-spark-crackle',
  wispFlicker: 'sky-theme-wisp-flicker',
} as const;

/** Hazard palettes: dark outlines with bright bodies, so danger reads by shape and value, not hue alone. */
export const SkyHazardPalette = {
  /** Spark cloud: outline, a lit violet body that holds 3:1 off the sky, yellow sparks. */
  sparkCloud: [0x1a1030, 0xc0a8e8, 0xfff060],
  /** Static wisp: outline, ice-blue body, white crackle. */
  staticWisp: [0x1a2448, 0x9ad8ff, 0xf4fcff],
} as const satisfies Record<string, Palette>;

/** Both hazards crackle on Phaser's clock, never on logic ticks. */
export const SKY_HAZARD_LOOPS: readonly AnimLoop[] = [
  // Three a second at most: the spark cloud's bright sparks are a flash (UI.md).
  { key: SkyHazardAnim.sparkCrackle, texture: SkyHazardTex.sparkCloud, frameRate: 3 },
  { key: SkyHazardAnim.wispFlicker, texture: SkyHazardTex.staticWisp, frameRate: 3 },
];

/** Hazard sheets. Each hazard's frames `a` and `b` move its sparks, so the loop crackles. */
export const SKY_HAZARD_SHEETS: readonly ArtSheet<string>[] = [
  sheet(SkyHazardTex.sparkCloud, SkyHazardPalette.sparkCloud, {
    [Frame.a]: [
      '2.........2.',
      '.2..0000.2..',
      '...011110...',
      '..01111110..',
      '.0111211110.',
      '011112211110',
      '011111221110',
      '.0111112110.',
      '..01111110..',
      '...000000...',
      '.2.......2..',
      '2.........2.',
    ],
    [Frame.b]: [
      '.....2......',
      '....0000....',
      '2..011110..2',
      '.2011111102.',
      '.0111121110.',
      '011112211110',
      '011122111110',
      '.0112111110.',
      '..01111110..',
      '.2.000000.2.',
      '2.........2.',
      '......2.....',
    ],
  }),
  sheet(SkyHazardTex.staticWisp, SkyHazardPalette.staticWisp, {
    [Frame.a]: [
      '....0000....',
      '...011110...',
      '..01122110..',
      '..01211210..',
      '..01122110..',
      '...011110...',
      '....0110....',
      '...0110.....',
      '..0110...2..',
      '.0110...2.2.',
      '.010........',
      '..0.........',
    ],
    [Frame.b]: [
      '....0000....',
      '...011110...',
      '..01122110..',
      '..01211210..',
      '..01122110..',
      '...011110...',
      '....0110....',
      '.....0110...',
      '.2....0110..',
      '2.2....0110.',
      '........010.',
      '.........0..',
    ],
  }),
];
