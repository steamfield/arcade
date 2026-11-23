/**
 * Farside's enemies drawn from code: a beetle that walks the floor, a boar that charges, a snake
 * that lunges from a hole in the wall (head and repeating body tile). Each sits in its Reef
 * counterpart's slot (crab, shark, eel) at the same size and with
 * the same frame names, and holds its main colour 3:1 off the space's canopy bands.
 */
import { Frame } from '../../../art/keys.ts';
import type { Palette, PixelRows } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { FarTex } from '../keys.ts';

/** One palette per enemy: outline, body, light, accent. */
export const FarEnemyPalette = {
  /** Beetle: dark brown outline, bright orange shell, peach shine, white eyes. */
  beetle: [0x2a1004, 0xff9a40, 0xffd090, 0xffffff],
  /** Boar: dark brown outline, tan hide, cream belly and tusk, red eye and gums. */
  boar: [0x2a140a, 0xe0a070, 0xffe8c0, 0xff4a3a],
  /** Snake: deep green outline, lime body, pale belly, red tongue and eye. */
  snake: [0x14280a, 0xc8e840, 0xf8ffa0, 0xff4a5a],
} as const satisfies Record<string, Palette>;

/** A row of `half` followed by its mirror image, so a symmetric sprite is drawn once. */
function mirrored(halves: PixelRows): PixelRows {
  return halves.map((half) => half + [...half].reverse().join(''));
}

const BEETLE_SHEET = sheet(FarTex.beetle, FarEnemyPalette.beetle, {
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

const BOAR_SHEET = sheet(FarTex.boar, FarEnemyPalette.boar, {
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
const SNAKE_HEAD_SHEET = sheet(FarTex.snakeHead, FarEnemyPalette.snake, {
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

const SNAKE_BODY_SHEET = sheet(FarTex.snakeBody, FarEnemyPalette.snake, {
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

/** World sheets for the beetle, boar and snake. */
export const FAR_ENEMY_SHEETS: readonly ArtSheet<string>[] = [
  BEETLE_SHEET,
  BOAR_SHEET,
  SNAKE_HEAD_SHEET,
  SNAKE_BODY_SHEET,
];
