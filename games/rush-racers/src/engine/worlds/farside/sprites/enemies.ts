/**
 * Farside's enemies drawn from code: a moon mite that crawls, a rocket ray that charges, a moon
 * worm that lunges from a crater (head and repeating segment tile). Each sits in its Reef
 * counterpart's slot (crab, shark, eel) at the same size and with the same frame names, and holds
 * its body colour 3:1 off the space bands.
 */

import { Frame } from '../../../art/keys.ts';
import type { Palette, PixelRows } from '../../../art/pixel.ts';
import { mirroredRows } from '../../../art/rows.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { FarTex } from '../keys.ts';

/** One palette per enemy: outline, body, light, accent. */
export const FarEnemyPalette = {
  /** Mite: deep teal outline, cyan shell, pale cyan shine and legs, red eyes. */
  mite: [0x06222a, 0x40e0e8, 0xc8ffff, 0xff4060],
  /** Ray: dark rust outline, orange hide, pale gold belly, a blue jet flame and eye. */
  ray: [0x2a0c04, 0xff8030, 0xffd090, 0x80e0ff],
  /** Worm: deep plum outline and segment seams, lilac body, pale lilac back, a yellow eye. */
  worm: [0x2a1040, 0xc0a0f0, 0xf0e0ff, 0xffe040],
} as const satisfies Record<string, Palette>;

const MITE_SHEET = sheet(FarTex.mite, FarEnemyPalette.mite, {
  // A round shell on three pairs of legs, feelers out; legs and feelers are pale so they show on the dark sky.
  [Frame.a]: mirroredRows([
    '........',
    '...2....',
    '....2...',
    '.....000',
    '....0122',
    '...01311',
    '2..01111',
    '.2011111',
    '2.011111',
    '.2.01111',
    '2...0000',
    '........',
  ]),
  // Feelers in, legs the other way.
  [Frame.b]: mirroredRows([
    '........',
    '....2...',
    '...2....',
    '.....000',
    '....0122',
    '...01311',
    '.2.01111',
    '22011111',
    '.2011111',
    '2..01111',
    '.2..0000',
    '........',
  ]),
  // Flipped on its back and dazed, legs kicking.
  [Frame.enemyStagger]: mirroredRows([
    '........',
    '........',
    '........',
    '2.2..2..',
    '.2.2.2..',
    '...00000',
    '..011111',
    '.0111111',
    '.0121111',
    '..011311',
    '...00000',
    '........',
  ]),
});

const RAY_SHEET = sheet(FarTex.ray, FarEnemyPalette.ray, {
  // Wings spread, a jet flame out of the tail.
  [Frame.a]: [
    '........................',
    '...........000..........',
    '..........01220.........',
    '.........0111120........',
    '........011111110.......',
    '.......01111111110000...',
    '33.0000111111111112300..',
    '3330222222222222222220..',
    '33.0000111111111111100..',
    '.......01111111110000...',
    '........011111110.......',
    '.........0111110........',
    '..........00000.........',
    '........................',
  ],
  // Wing tips folded a little, the flame flickering.
  [Frame.b]: [
    '........................',
    '........................',
    '..........00000.........',
    '.........0111120........',
    '........011111110.......',
    '.......01111111110000...',
    '3..0000111111111112300..',
    '.330222222222222222220..',
    '3..0000111111111111100..',
    '.......01111111110000...',
    '........011111110.......',
    '.........0111110........',
    '..........0000..........',
    '........................',
  ],
  // Wings swept back, eye blazing and the flame at full burn: the wind-up and the charge.
  [Frame.enemyBite]: [
    '........................',
    '.........000............',
    '........01220...........',
    '.......0111120..........',
    '......011111110.........',
    '.....01111111110000.....',
    '3330000111111111113300..',
    '3330222222222222222220..',
    '3330000111111111111100..',
    '.....01111111110000.....',
    '......011111110.........',
    '.......0111110..........',
    '........00000...........',
    '........................',
  ],
  // Flame out, eye shut, both wings drooping below the body side by side, the top one showing its pale side: stunned and tumbling.
  [Frame.enemyStagger]: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '.......00000000000000...',
    '...0000111111111110200..',
    '...0222222222222222220..',
    '...0000111111111111100..',
    '.......0111111002222220.',
    '.......011111100222220..',
    '.......01111100022220...',
    '.......0000000.000000...',
    '........................',
  ],
});

// The head's neck on the left lines up with the segment tile row for row, seam included.
const WORM_HEAD_SHEET = sheet(FarTex.wormHead, FarEnemyPalette.worm, {
  // Mouth shut, a yellow eye.
  [Frame.a]: [
    '................',
    '.....0000000....',
    '0000012222220...',
    '22201111111130..',
    '1110111111111110',
    '1110111111100000',
    '11101111111110..',
    '0000000000000...',
    '................',
    '................',
  ],
  // Jaws wide and fangs out: the lunge.
  [Frame.b]: [
    '................',
    '.....0000000....',
    '0000012222220...',
    '22201111111130..',
    '1110111111110...',
    '11101111110.2.2.',
    '11101111111120..',
    '0000000000000...',
    '................',
    '................',
  ],
});

const WORM_BODY_SHEET = sheet(FarTex.wormBody, FarEnemyPalette.worm, {
  // Two segments per tile, split by dark seams.
  [Frame.a]: [
    '........',
    '........',
    '00000000',
    '22202220',
    '11101110',
    '11101110',
    '11101110',
    '00000000',
    '........',
    '........',
  ],
});

/** World sheets for the mite, ray and worm. */
export const FAR_ENEMY_SHEETS: readonly ArtSheet<string>[] = [MITE_SHEET, RAY_SHEET, WORM_HEAD_SHEET, WORM_BODY_SHEET];
