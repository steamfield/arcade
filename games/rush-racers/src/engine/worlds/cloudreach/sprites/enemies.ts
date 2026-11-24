/**
 * Cloudreach's enemies drawn from code: a cloud crab that walks the floor with a puff of cloud on its
 * shell, a storm crow that dives, and a sky eel that lunges from a hole in a cloud (head and repeating
 * body tile). Each sits in its Reef counterpart's slot (crab, shark, eel) at the same size and with
 * the same frame names, and holds its main colour 3:1 off the sky's bands.
 */
import { Frame } from '../../../art/keys.ts';
import type { Palette, PixelRows } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { SkyTex } from '../keys.ts';

/** One palette per enemy: outline, body, light, accent. */
export const SkyEnemyPalette = {
  /** Cloud crab: dark maroon outline, coral shell, a peach shine, white cloud puffs and eyes. */
  cloudCrab: [0x2a0e14, 0xff8a6a, 0xffd0b8, 0xffffff],
  /** Storm crow: ink outline, storm-violet feathers, a pale lilac belly and wing edge, a lightning-yellow eye and beak. */
  stormCrow: [0x1a1030, 0xb0a0ec, 0xe4dcff, 0xffd23a],
  /** Sky eel: deep teal outline, aqua body, a pale belly and fin, pink spots, eye and fangs. */
  skyEel: [0x0a2a30, 0x5ee0c8, 0xd8fff4, 0xff6a9a],
} as const satisfies Record<string, Palette>;

/** A row of `half` followed by its mirror image, so a symmetric sprite is drawn once. */
function mirrored(halves: PixelRows): PixelRows {
  return halves.map((half) => half + [...half].reverse().join(''));
}

/** The same rows bottom to top: an enemy knocked onto its back. */
function upsideDown(rows: PixelRows): PixelRows {
  return [...rows].reverse();
}

// Claws up, legs out.
const CRAB_STRIDE_A = mirrored([
  '.00.....',
  '0230....',
  '0110.030',
  '.010..0.',
  '..0.0330',
  '..003333',
  '.0111111',
  '01121111',
  '01111111',
  '.0000000',
  '.0.0.0..',
  '0.0.0...',
]);

// Claws lower, legs in.
const CRAB_STRIDE_B = mirrored([
  '........',
  '.00.....',
  '0230.030',
  '0110..0.',
  '.00.0330',
  '..003333',
  '.0111111',
  '01121111',
  '01111111',
  '.0000000',
  '..0.0.0.',
  '.0.0.0..',
]);

const CLOUD_CRAB_SHEET = sheet(SkyTex.cloudCrab, SkyEnemyPalette.cloudCrab, {
  [Frame.a]: CRAB_STRIDE_A,
  [Frame.b]: CRAB_STRIDE_B,
  [Frame.enemyStagger]: upsideDown(CRAB_STRIDE_A),
});

// Pointing right: a fringed wing raised over the back, a fanned tail at the left, yellow eye and beak.
const CROW_WINGS_UP: PixelRows = [
  '....0.0.0...............',
  '...0101010..............',
  '...01111110.............',
  '....01111110............',
  '.....02111110...........',
  '......02111110...000....',
  '00.....02111110001110...',
  '010..00002111111113110..',
  '011001111111111111113330',
  '.0111111111111111111000.',
  '01100222222222222110....',
  '010..00000000000000.....',
  '00........3..3..........',
  '........................',
];

const STORM_CROW_SHEET = sheet(SkyTex.stormCrow, SkyEnemyPalette.stormCrow, {
  [Frame.a]: CROW_WINGS_UP,
  // The wing swept down under the body, its fringe at the bottom.
  [Frame.b]: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '.................000....',
    '00.....00000000001110...',
    '010..00111111111113110..',
    '011001111111111111113330',
    '.0111111111111111111000.',
    '01100211111111102110....',
    '010..01111111110.000....',
    '00...011111110..........',
    '......0101010...........',
  ],
  // Wing swept back, beak open, talons out: the wind-up and the dive.
  [Frame.enemyBite]: [
    '..0.0.0.................',
    '.0101010................',
    '.011111100..............',
    '..0111111100............',
    '...0021111110...........',
    '......02111110...000....',
    '00.....02111110001110...',
    '010..0000211111111311033',
    '011001111111111111110...',
    '.0111111111111111111033.',
    '01100222222222222110....',
    '010..00000000000000.....',
    '00.......33..33.........',
    '........................',
  ],
  // Tumbled onto its back and dazed, feet in the air.
  [Frame.enemyStagger]: upsideDown(CROW_WINGS_UP),
});

// The neck on the left joins the body tile row for row.
const SKY_EEL_HEAD_SHEET = sheet(SkyTex.skyEelHead, SkyEnemyPalette.skyEel, {
  // A crested head wider than the body, mouth shut, a pink eye.
  [Frame.a]: [
    '.........2.2....',
    '.2...2..00000...',
    '00000000111110..',
    '111111111113010.',
    '1131111311111110',
    '111111111111000.',
    '22222222222220..',
    '0000000022220...',
    '........0000....',
    '................',
  ],
  // Jaws wide, pink fangs: the lunge.
  [Frame.b]: [
    '.........2.2....',
    '.2...2..00000...',
    '00000000111110..',
    '111111111113010.',
    '113111131110000.',
    '11111111110.3.3.',
    '2222222220..3.3.',
    '000000002222220.',
    '........000000..',
    '................',
  ],
});

const SKY_EEL_BODY_SHEET = sheet(SkyTex.skyEelBody, SkyEnemyPalette.skyEel, {
  // A pale fin tuft on top, pink spots along the side.
  [Frame.a]: [
    '........',
    '.2...2..',
    '00000000',
    '11111111',
    '11311113',
    '11111111',
    '22222222',
    '00000000',
    '........',
    '........',
  ],
});

/** World sheets for the cloud crab, storm crow and sky eel. */
export const SKY_ENEMY_SHEETS: readonly ArtSheet<string>[] = [
  CLOUD_CRAB_SHEET,
  STORM_CROW_SHEET,
  SKY_EEL_HEAD_SHEET,
  SKY_EEL_BODY_SHEET,
];
