/**
 * Art for the enemies a racer beats with a dash bonk: a shark, a moray eel that lives in the reef
 * wall, and a crab that walks the floor. Each reads by silhouette first (fin and jaws, a long body
 * out of a hole, raised claws on stalked eyes) and holds its main colour 3:1 off every theme's
 * water. The marks sheet carries what the view draws around them: the eel's hole and the eyes in
 * it, the shark's `!` tell, warning bubbles, the dizzy star of a stagger and the pop of a defeat.
 */
import { Frame, Tex } from '../keys.ts';
import type { NamedFrame, Palette, PixelRows } from '../pixel.ts';
import { type ArtSheet, sheet } from './sheet.ts';

/** One palette per enemy kind: outline, body, light (belly or shell shine), accent. */
export const EnemyPalette = {
  /** Shark: deep slate outline, steel body, white belly and teeth, red gums and eye glint. */
  shark: [0x141a2a, 0x9aaac0, 0xf4f6fa, 0xff4a5a],
  /** Eel: deep green outline, bright green body, pale belly, yellow eyes and spots. */
  eel: [0x0c2a14, 0x6ad84a, 0xd8f8a0, 0xffe040],
  /** Crab: dark red outline, orange shell, peach shine, white eyes. */
  crab: [0x3a0c08, 0xff8050, 0xffc8a0, 0xffffff],
} as const satisfies Record<string, Palette>;

/** The marks' palettes; each mark frame has its own. */
const MarkPalette = {
  /** A hole in the reef wall: near black with a dim rim, yellow eyes with a white glint. */
  hole: [0x05060e, 0x2a2238, 0xffe040, 0xffffff],
  /** The `!` tell: ink glyph on a sun-gold bubble with a foam shine, the UI's alert colours. */
  alert: [0x0b0a1e, 0xffc53a, 0xf6f0dc],
  /** A small warning bubble: rim and shine. */
  bubble: [0xb8f4ff, 0xffffff],
  /** Dizzy and bonk star: outline, gold, white core. */
  star: [0x3a2008, 0xffe060, 0xffffff],
  /** Pop ring: white with gold sparkles. */
  pop: [0xffffff, 0xffe060],
} as const satisfies Record<string, Palette>;

/** A row of `half` followed by its mirror image, so a symmetric sprite is drawn once. */
function mirrored(halves: PixelRows): PixelRows {
  return halves.map((half) => half + [...half].reverse().join(''));
}

/** Size of each frame in the marks sheet, px. */
export const MARK_SIZE = 12;

const SHARK_SHEET = sheet(Tex.shark, EnemyPalette.shark, {
  // Tail up.
  [Frame.a]: [
    '............00..........',
    '...........010..........',
    '..........0110..........',
    '0.........01110.........',
    '00......00111110000.....',
    '010...0011111111111100..',
    '01100011111111111101100.',
    '.0111111111111111111110.',
    '.01111111111111111111110',
    '0110022222222222222220..',
    '010...00222222222220....',
    '00.......001100000......',
    '0.........0110..........',
    '...........00...........',
  ],
  // Tail down.
  [Frame.b]: [
    '............00..........',
    '...........010..........',
    '..........0110..........',
    '..........01110.........',
    '........00111110000.....',
    '0.....0011111111111100..',
    '00..0011111111111101100.',
    '0100111111111111111110..',
    '01111111111111111111110.',
    '0110022222222222222220..',
    '010...00222222222220....',
    '0........001100000......',
    '..........0110..........',
    '...........00...........',
  ],
  // Jaws open, teeth bared, the eye lit red: the wind-up and the charge.
  [Frame.enemyBite]: [
    '............00..........',
    '...........010..........',
    '..........0110..........',
    '0.........01110.........',
    '00......00111110000.....',
    '010...0011111111111100..',
    '01100011111111111131100.',
    '.0111111111111111111110.',
    '.011111111111111110000..',
    '0110022222222220323232..',
    '010...002222222033333...',
    '00.......0011000222220..',
    '0.........0110..0000....',
    '...........00...........',
  ],
  // Rolled belly-up and dazed: eye crossed out, fins limp.
  [Frame.enemyStagger]: [
    '........................',
    '...........00...........',
    '..........0110..........',
    '00.......001100000......',
    '010...00222222222220....',
    '0110022222222222222220..',
    '.01111111111111111111110',
    '.0111111111111111101010.',
    '01100011111111111110100.',
    '010...0011111111110101..',
    '00......00111110000.....',
    '0.........01110.........',
    '..........0110..........',
    '...........00...........',
  ],
});

const EEL_HEAD_SHEET = sheet(Tex.eelHead, EnemyPalette.eel, {
  // Mouth shut, a yellow eye; the neck on the left joins the body tile row for row.
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
  // Jaws wide, pale teeth showing: the lunge.
  [Frame.b]: [
    '................',
    '....00000000....',
    '0000111111110...',
    '11111111113310..',
    '111111111111110.',
    '111111110.......',
    '2222222220.2.2..',
    '000022222222220.',
    '....0000000000..',
    '................',
  ],
});

const EEL_BODY_SHEET = sheet(Tex.eelBody, EnemyPalette.eel, {
  [Frame.a]: [
    '........',
    '........',
    '00000000',
    '11111111',
    '13111131',
    '11111111',
    '22222222',
    '00000000',
    '........',
    '........',
  ],
});

const CRAB_SHEET = sheet(Tex.crab, EnemyPalette.crab, {
  // Claws open, legs out.
  [Frame.a]: mirrored([
    '.00.....',
    '0120.03.',
    '01.10.0.',
    '0110..0.',
    '.0110000',
    '..011111',
    '.0112211',
    '.0111111',
    '..000000',
    '.0.0.0..',
    '0.0.0...',
    '........',
  ]),
  // Claws snapped shut, legs in.
  [Frame.b]: mirrored([
    '........',
    '.00..03.',
    '0120..0.',
    '0110..0.',
    '.0110000',
    '..011111',
    '.0112211',
    '.0111111',
    '..000000',
    '..0.0.0.',
    '.0.0.0..',
    '........',
  ]),
  // Flattened, eye stalks drooping, claws flat on the floor.
  [Frame.enemyStagger]: mirrored([
    '........',
    '........',
    '......0.',
    '.....0..',
    '..000000',
    '.0111111',
    '01122111',
    '01111111',
    '00000000',
    '0110.0.0',
    '.00.....',
    '........',
  ]),
});

/** The marks, each on a 12x12 frame with its own palette. */
const MARK_FRAMES: readonly NamedFrame[] = [
  {
    name: Frame.markHole,
    palette: MarkPalette.hole,
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
    palette: MarkPalette.hole,
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
    palette: MarkPalette.alert,
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
    palette: MarkPalette.bubble,
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
    palette: MarkPalette.star,
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
    palette: MarkPalette.pop,
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
export const ENEMY_SHEETS: readonly ArtSheet[] = [
  SHARK_SHEET,
  EEL_HEAD_SHEET,
  EEL_BODY_SHEET,
  CRAB_SHEET,
  { key: Tex.enemyMark, frames: MARK_FRAMES },
];
