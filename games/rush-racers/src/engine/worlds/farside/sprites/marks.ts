/**
 * Farside's enemy marks on 12x12 frames: the crater and the eyes in it, the warning triangle tell,
 * a puff of moon dust, the dizzy star of a stagger and the pop burst of a defeat. Frame names follow `Frame` in
 * `art/keys.ts`, since the enemy view asks for them by name.
 */
import { Frame } from '../../../art/keys.ts';
import type { NamedFrame, Palette } from '../../../art/pixel.ts';
import type { ArtSheet } from '../../../art/sprites/sheet.ts';
import { FarTex } from '../keys.ts';

/** The marks' palettes; each mark frame has its own. */
const FarMarkPalette = {
  /** A crater: near black inside, a grey moon-rock rim, yellow eyes with a white glint. */
  hole: [0x05060e, 0x6a6a88, 0xffe040, 0xffffff],
  /** The warning triangle: ink `!` and edge, amber face, a pale shine. */
  alert: [0x0b0a1e, 0xffc53a, 0xf6f0dc],
  /** A puff of moon dust: grey grains and a white fleck. */
  dust: [0xb0b8d0, 0xffffff],
  /** Dizzy and bonk star: outline, gold, white core. */
  star: [0x3a2008, 0xffe060, 0xffffff],
  /** Pop burst: white rays with cyan sparks. */
  pop: [0xffffff, 0x80e0ff],
} as const satisfies Record<string, Palette>;

/** The marks, each on a 12x12 frame with its own palette. */
const MARK_FRAMES: readonly NamedFrame[] = [
  {
    name: Frame.markHole,
    palette: FarMarkPalette.hole,
    rows: [
      '............',
      '............',
      '............',
      '...111111...',
      '.1100000011.',
      '110000000011',
      '100000000001',
      '110000000011',
      '.1100000011.',
      '...111111...',
      '............',
      '............',
    ],
  },
  {
    name: Frame.markEyes,
    palette: FarMarkPalette.hole,
    rows: [
      '............',
      '............',
      '............',
      '...111111...',
      '.1100000011.',
      '110000000011',
      '100230032001',
      '110220022011',
      '.1100000011.',
      '...111111...',
      '............',
      '............',
    ],
  },
  {
    name: Frame.markAlert,
    palette: FarMarkPalette.alert,
    rows: [
      '.....00.....',
      '....0220....',
      '....0110....',
      '...011110...',
      '...010010...',
      '..01100110..',
      '..01100110..',
      '.0111001110.',
      '.0111111110.',
      '011110011110',
      '011111111110',
      '000000000000',
    ],
  },
  {
    name: Frame.markBubble,
    palette: FarMarkPalette.dust,
    rows: [
      '............',
      '............',
      '............',
      '............',
      '......0.....',
      '...00.00....',
      '..0000100...',
      '...00000.0..',
      '....0.00....',
      '............',
      '............',
      '............',
    ],
  },
  {
    name: Frame.markStar,
    palette: FarMarkPalette.star,
    rows: [
      '.....00.....',
      '....0110....',
      '....0220....',
      '000001100000',
      '011111111110',
      '.0111221110.',
      '..01122110..',
      '..01111110..',
      '.0111001110.',
      '.0110..0110.',
      '.000....000.',
      '............',
    ],
  },
  {
    name: Frame.markPop,
    palette: FarMarkPalette.pop,
    rows: [
      '0....00....0',
      '.0........0.',
      '..0......0..',
      '.....11.....',
      '....1..1....',
      '00.1....1.00',
      '00.1....1.00',
      '....1..1....',
      '.....11.....',
      '..0......0..',
      '.0........0.',
      '0....00....0',
    ],
  },
];

/** The marks sheet. */
export const FAR_MARK_SHEET: ArtSheet<string> = { key: FarTex.marks, frames: MARK_FRAMES };
