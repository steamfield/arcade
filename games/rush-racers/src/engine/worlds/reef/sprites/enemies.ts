/**
 * Reef's enemies, the ones a racer beats with a dash bonk: a shark, a moray eel that lives in the
 * reef wall (head and repeating body tile), and a crab that walks the floor. Each reads by
 * silhouette first (fin and jaws, a long body out of a hole, raised claws on stalked eyes) and holds
 * its main colour 3:1 off every theme's water. The marks drawn around them are in `marks.ts`.
 */

import { Frame } from '../../../art/keys.ts';
import type { Palette, PixelRows } from '../../../art/pixel.ts';
import { mirroredRows } from '../../../art/rows.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { ReefTex } from '../keys.ts';

/** One palette per enemy kind: outline, body, light (belly or shell shine), accent. */
export const ReefEnemyPalette = {
  /** Shark: deep slate outline, steel body, white belly and teeth, red gums and eye glint. */
  shark: [0x141a2a, 0x9aaac0, 0xf4f6fa, 0xff4a5a],
  /** Eel: deep green outline, bright green body, pale belly, yellow eyes and spots. */
  eel: [0x0c2a14, 0x6ad84a, 0xd8f8a0, 0xffe040],
  /** Crab: dark red outline, orange shell, peach shine, white eyes. */
  crab: [0x3a0c08, 0xff8050, 0xffc8a0, 0xffffff],
} as const satisfies Record<string, Palette>;

const SHARK_SHEET = sheet(ReefTex.shark, ReefEnemyPalette.shark, {
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

const EEL_HEAD_SHEET = sheet(ReefTex.eelHead, ReefEnemyPalette.eel, {
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

const EEL_BODY_SHEET = sheet(ReefTex.eelBody, ReefEnemyPalette.eel, {
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

const CRAB_SHEET = sheet(ReefTex.crab, ReefEnemyPalette.crab, {
  // Claws open, legs out.
  [Frame.a]: mirroredRows([
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
  [Frame.b]: mirroredRows([
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
  [Frame.enemyStagger]: mirroredRows([
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

/** World sheets for the three enemies: the shark, the eel's head and body tile, and the crab. */
export const REEF_ENEMY_SHEETS: readonly ArtSheet<string>[] = [SHARK_SHEET, EEL_HEAD_SHEET, EEL_BODY_SHEET, CRAB_SHEET];
