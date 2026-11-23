/**
 * The Easy guide's arrow: a chunky 13x13 arrow in sun yellow with a near-black outline, drawn
 * once pointing right and once pointing down-right. The view turns them in quarter turns to cover
 * all eight directions, so every turn is exact pixel art (no rotated-pixel shimmer).
 */
import { Frame, Tex } from '../keys.ts';
import type { Palette } from '../pixel.ts';
import { type ArtSheet, sheet } from './sheet.ts';

/** Outline, sun body, pale highlight: the colours of the hint text, bright on every water band. */
export const GUIDE_PALETTE: Palette = [0x0a0a14, 0xffd23f, 0xfff4b0];

/** Side of the arrow's square frame, px. */
export const GUIDE_SIZE = 13;

/** The guide sheet: the arrow pointing right, and pointing down-right. */
export const GUIDE_SHEETS: readonly ArtSheet[] = [
  sheet(Tex.guideArrow, GUIDE_PALETTE, {
    [Frame.guideStraight]: [
      '.............',
      '......00.....',
      '......020....',
      '......0110...',
      '00000021110..',
      '021111111110.',
      '0111111111110',
      '011111111110.',
      '00000011110..',
      '......0110...',
      '......010....',
      '......00.....',
      '.............',
    ],
    [Frame.guideDiagonal]: [
      '000..........',
      '0110.........',
      '01110........',
      '.01110.......',
      '..01110......',
      '...01110....0',
      '....01110..00',
      '.....01110020',
      '......0111110',
      '.......011110',
      '.......011110',
      '......0211110',
      '.....00000000',
    ],
  }),
];
