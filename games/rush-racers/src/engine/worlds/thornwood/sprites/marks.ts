/**
 * Thornwood's enemy marks on 12x12 frames: the burrow and the eyes in it, the `!` tell, a puff of
 * dust, the dizzy star of a stagger and the pop ring of a defeat. Frame names follow `Frame` in
 * `art/keys.ts`, since the enemy view asks for them by name.
 */
import { Frame } from '../../../art/keys.ts';
import type { NamedFrame, Palette } from '../../../art/pixel.ts';
import type { ArtSheet } from '../../../art/sprites/sheet.ts';
import { ThornTex } from '../keys.ts';

/** The marks' palettes; each mark frame has its own. */
const ThornMarkPalette = {
  /** A burrow in the bank: near black with a dim earth rim, yellow eyes with a white glint. */
  hole: [0x05060e, 0x4a3422, 0xffe040, 0xffffff],
  /** The `!` tell: ink glyph on a sun-gold bubble with a pale shine. */
  alert: [0x0b0a1e, 0xffc53a, 0xf6f0dc],
  /** A warning puff of dust: rim and shine. */
  bubble: [0xe0f0b8, 0xffffff],
  /** Dizzy and bonk star: outline, gold, white core. */
  star: [0x3a2008, 0xffe060, 0xffffff],
  /** Pop ring: white with leaf-green sparkles. */
  pop: [0xffffff, 0xa8ff70],
} as const satisfies Record<string, Palette>;

/** The marks, each on a 12x12 frame with its own palette. */
const MARK_FRAMES: readonly NamedFrame[] = [
  {
    name: Frame.markHole,
    palette: ThornMarkPalette.hole,
    rows: [
      '............',
      '............',
      '...111111...',
      '..10000001..',
      '.1000000001.',
      '.1000000001.',
      '.1000000001.',
      '.1000000001.',
      '..10000001..',
      '...111111...',
      '............',
      '............',
    ],
  },
  {
    name: Frame.markEyes,
    palette: ThornMarkPalette.hole,
    rows: [
      '............',
      '............',
      '...111111...',
      '..10000001..',
      '.1000000001.',
      '.1322002231.',
      '.1222002221.',
      '.1000000001.',
      '..10000001..',
      '...111111...',
      '............',
      '............',
    ],
  },
  {
    name: Frame.markAlert,
    palette: ThornMarkPalette.alert,
    rows: [
      '...000000...',
      '..01211110..',
      '.0121001110.',
      '.0111001110.',
      '.0111001110.',
      '.0111001110.',
      '.0111111110.',
      '.0111001110.',
      '..01111110..',
      '...000000...',
      '....010.....',
      '.....0......',
    ],
  },
  {
    name: Frame.markBubble,
    palette: ThornMarkPalette.bubble,
    rows: [
      '............',
      '............',
      '............',
      '............',
      '.....00.....',
      '....0.10....',
      '....0..0....',
      '.....00.....',
      '............',
      '............',
      '............',
      '............',
    ],
  },
  {
    name: Frame.markStar,
    palette: ThornMarkPalette.star,
    rows: [
      '.....0......',
      '.....0......',
      '....010.....',
      '....010.....',
      '...01210....',
      '00112221100.',
      '...01210....',
      '....010.....',
      '....010.....',
      '.....0......',
      '.....0......',
      '............',
    ],
  },
  {
    name: Frame.markPop,
    palette: ThornMarkPalette.pop,
    rows: [
      '....0000....',
      '..00....00..',
      '.0........0.',
      '.0..1..1..0.',
      '0..........0',
      '0....11....0',
      '0....11....0',
      '0..........0',
      '.0..1..1..0.',
      '.0........0.',
      '..00....00..',
      '....0000....',
    ],
  },
];

/** The marks sheet. */
export const THORN_MARK_SHEET: ArtSheet<string> = { key: ThornTex.marks, frames: MARK_FRAMES };
