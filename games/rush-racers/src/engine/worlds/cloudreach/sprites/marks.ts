/**
 * Cloudreach's enemy marks on 12x12 frames: the dark hole in a cloud and the eyes in it, the `!` tell
 * in a round puff, a small puff of cloud, the dizzy star of a stagger and the burst of a defeat. Frame
 * names follow `Frame` in `art/keys.ts`, since the enemy view asks for them by name.
 */
import { Frame } from '../../../art/keys.ts';
import type { NamedFrame, Palette } from '../../../art/pixel.ts';
import type { ArtSheet } from '../../../art/sprites/sheet.ts';
import { SkyTex } from '../keys.ts';

/** The marks' palettes; each mark frame has its own. */
const SkyMarkPalette = {
  /** A hole in a cloud: near black with a pale cloud rim, yellow eyes with a white glint. */
  hole: [0x0a0c1e, 0xc8d2e8, 0xffe040, 0xffffff],
  /** The `!` tell: ink glyph on a lightning-yellow puff with a pale shine. */
  alert: [0x0b0a1e, 0xffd84a, 0xfff8dc],
  /** A warning puff of cloud: rim and shine. */
  bubble: [0xd8e4ff, 0xffffff],
  /** Dizzy and bonk star: outline, gold, white core. */
  star: [0x2a1a40, 0xffe060, 0xffffff],
  /** Defeat burst: white rays around a sky-blue sparkle. */
  pop: [0xffffff, 0x9ad8ff],
} as const satisfies Record<string, Palette>;

/** The hole an eel waits in, with or without its eyes showing. */
const HOLE_ROWS = [
  '............',
  '...1.11.1...',
  '..11111111..',
  '.1100000011.',
  '.1000000001.',
  '110000000011',
  '.1000000001.',
  '.1100000011.',
  '..11111111..',
  '...1.11.1...',
  '............',
  '............',
];

const EYES_ROWS = [
  '............',
  '...1.11.1...',
  '..11111111..',
  '.1100000011.',
  '.1032002301.',
  '110220022011',
  '.1000000001.',
  '.1100000011.',
  '..11111111..',
  '...1.11.1...',
  '............',
  '............',
];

/** The marks, each on a 12x12 frame with its own palette. */
const MARK_FRAMES: readonly NamedFrame[] = [
  { name: Frame.markHole, palette: SkyMarkPalette.hole, rows: HOLE_ROWS },
  { name: Frame.markEyes, palette: SkyMarkPalette.hole, rows: EYES_ROWS },
  {
    name: Frame.markAlert,
    palette: SkyMarkPalette.alert,
    rows: [
      '...000000...',
      '..02111110..',
      '.0211001110.',
      '011110011110',
      '011110011110',
      '011110011110',
      '.0111111110.',
      '.0111001110.',
      '..01111110..',
      '...0100000..',
      '....010.....',
      '.....0......',
    ],
  },
  {
    name: Frame.markBubble,
    palette: SkyMarkPalette.bubble,
    rows: [
      '............',
      '............',
      '............',
      '............',
      '.....00.....',
      '...00..0....',
      '..0.1...0...',
      '..0......0..',
      '...000000...',
      '............',
      '............',
      '............',
    ],
  },
  {
    name: Frame.markStar,
    palette: SkyMarkPalette.star,
    rows: [
      '.....0......',
      '.....0......',
      '....010.....',
      '00001210000.',
      '.011222110..',
      '..0112110...',
      '...01110....',
      '...01010....',
      '..010.010...',
      '..00...00...',
      '............',
      '............',
    ],
  },
  {
    name: Frame.markPop,
    palette: SkyMarkPalette.pop,
    rows: [
      '.0...00...0.',
      '..0..00..0..',
      '...0....0...',
      '............',
      '.....11.....',
      '00..1..1..00',
      '00..1..1..00',
      '.....11.....',
      '............',
      '...0....0...',
      '..0..00..0..',
      '.0...00...0.',
    ],
  },
];

/** The marks sheet. */
export const SKY_MARK_SHEET: ArtSheet<string> = { key: SkyTex.marks, frames: MARK_FRAMES };
