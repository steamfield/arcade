/**
 * Thornwood's enemies drawn from code: a beetle that walks the floor, a boar that charges, a snake
 * that lunges from a hole in the wall (head and repeating body tile), and the marks the view draws
 * around them. Each sits in its Reef counterpart's slot (crab, shark, eel) at the same size and with
 * the same frame names, and holds its main colour 3:1 off the forest's canopy bands.
 */
import { Frame } from '../../../art/keys.ts';
import type { NamedFrame, Palette, PixelRows } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { ThornTex } from '../keys.ts';

/** One palette per enemy: outline, body, light, accent. */
export const ThornEnemyPalette = {
  /** Beetle: dark brown outline, bright orange shell, peach shine, white eyes. */
  beetle: [0x2a1004, 0xff9a40, 0xffd090, 0xffffff],
  /** Boar: dark brown outline, tan hide, cream belly and tusk, red eye and gums. */
  boar: [0x2a140a, 0xe0a070, 0xffe8c0, 0xff4a3a],
  /** Snake: deep green outline, lime body, pale belly, red tongue and eye. */
  snake: [0x14280a, 0xc8e840, 0xf8ffa0, 0xff4a5a],
} as const satisfies Record<string, Palette>;

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

/** A row of `half` followed by its mirror image, so a symmetric sprite is drawn once. */
function mirrored(halves: PixelRows): PixelRows {
  return halves.map((half) => half + [...half].reverse().join(''));
}

const BEETLE_SHEET = sheet(ThornTex.beetle, ThornEnemyPalette.beetle, {
  // Feelers up, legs out.
  [Frame.a]: mirrored([
    '..0..0..',
    '...00.0.',
    '..0110..',
    '.011110.',
    '0112211.',
    '0111101.',
    '0111101.',
    '0111101.',
    '.000000.',
    '.0.0.0..',
    '0.0.0...',
    '........',
  ]),
  // Feelers down, legs in.
  [Frame.b]: mirrored([
    '........',
    '..0..0..',
    '...00.0.',
    '..0110..',
    '.011110.',
    '0112211.',
    '0111101.',
    '0111101.',
    '.000000.',
    '..0.0.0.',
    '.0.0.0..',
    '........',
  ]),
  // Flipped dazed: shell flat, feelers drooping, legs in the air.
  [Frame.enemyStagger]: mirrored([
    '........',
    '........',
    '........',
    '.0.0.0..',
    '0.0.0.0.',
    '.000000.',
    '0111111.',
    '0112211.',
    '0111101.',
    '.011110.',
    '..0000..',
    '........',
  ]),
});

const BOAR_SHEET = sheet(ThornTex.boar, ThornEnemyPalette.boar, {
  // Legs reaching out.
  [Frame.a]: [
    '........................',
    '....0.0.0.0.0...........',
    '...01010101010000.......',
    '..0111111111111110000...',
    '.011111111111111111110..',
    '.0111111111111111011110.',
    '0111111111111111112110..',
    '0111111111111111111110..',
    '.01111111111111111110...',
    '..0022222222222222200...',
    '...010.010...010.010....',
    '...010.010...010.010....',
    '..000..000...000..000...',
    '........................',
  ],
  // Legs gathered.
  [Frame.b]: [
    '........................',
    '....0.0.0.0.0...........',
    '...01010101010000.......',
    '..0111111111111110000...',
    '.011111111111111111110..',
    '.0111111111111111011110.',
    '0111111111111111112110..',
    '0111111111111111111110..',
    '.01111111111111111110...',
    '..0022222222222222200...',
    '....010.010.010.010.....',
    '....010.010.010.010.....',
    '...000..000.000..000....',
    '........................',
  ],
  // Head down, tusk out and the eye lit red: the wind-up and the charge.
  [Frame.enemyBite]: [
    '........................',
    '........................',
    '...0.0.0.0.0............',
    '..0101010101000.........',
    '.011111111111111000.....',
    '.0111111111111111110000.',
    '011111111111111110311110',
    '0111111111111111112000..',
    '.011111111111111110222..',
    '..002222222222222202220.',
    '...010.010...010.00000..',
    '...010.010...010........',
    '..000..000...000........',
    '........................',
  ],
  // Rolled on its back and dazed, legs in the air.
  [Frame.enemyStagger]: [
    '........................',
    '...0.0..0.0..0.0........',
    '...010..010..010........',
    '...010..010..010........',
    '..0022222222222222200...',
    '.01111111111111111110...',
    '0111111111111111111110..',
    '0111111111111111110110..',
    '.011111111111111110100..',
    '.0111111111111111101010.',
    '..0111111111111110000...',
    '...010101010100.........',
    '....0.0.0.0.0...........',
    '........................',
  ],
});

// Neck on the left joins the body tile row for row.
const SNAKE_HEAD_SHEET = sheet(ThornTex.snakeHead, ThornEnemyPalette.snake, {
  // Mouth shut, a red eye.
  [Frame.a]: [
    '................',
    '....00000000....',
    '0000111111110...',
    '11111111113310..',
    '111111111111110.',
    '11111111100000..',
    '2222222222220...',
    '000000000000....',
    '................',
    '................',
  ],
  // Jaws wide, fangs and a forked tongue: the lunge.
  [Frame.b]: [
    '................',
    '....00000000....',
    '0000111111110...',
    '11111111113310..',
    '111111111111110.',
    '111111110....3.3',
    '2222222220.2.33.',
    '000022222222220.',
    '....0000000000..',
    '................',
  ],
});

const SNAKE_BODY_SHEET = sheet(ThornTex.snakeBody, ThornEnemyPalette.snake, {
  [Frame.a]: [
    '........',
    '........',
    '00000000',
    '11111111',
    '12111121',
    '11111111',
    '22222222',
    '00000000',
    '........',
    '........',
  ],
});

/** Size of each frame in the marks sheet, px. */
export const THORN_MARK_SIZE = 12;

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

/** World sheets for the three enemies and their marks. */
export const THORN_ENEMY_SHEETS: readonly ArtSheet<string>[] = [
  BEETLE_SHEET,
  BOAR_SHEET,
  SNAKE_HEAD_SHEET,
  SNAKE_BODY_SHEET,
  { key: ThornTex.marks, frames: MARK_FRAMES },
];
