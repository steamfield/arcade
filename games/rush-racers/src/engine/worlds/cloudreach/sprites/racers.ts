/**
 * Cloudreach's eight flyers, 16x12 and facing right (the racer view flips them), each drawn around
 * the same 12x10 body as Reef's racers with two wing-beat frames, one texture per slot. Light comes
 * from the top left: lit pixels sit on top edges, the second colour is the pale belly or the dark
 * plumage, and a dark outline closes each body. Thin parts (beaks, feet, tails, antennae, paws)
 * are 1 px unoutlined lines in a body colour, so they stay thin. In frame `a` the wings are up; in
 * frame `b` they are down, which reads as one stroke with the flap squash.
 *
 * Colours come from `palette.ts`, shared with the portraits and heads.
 */
import type { CharacterId } from '../../../../logic/types.ts';
import { CHARACTER_IDS } from '../../../../logic/types.ts';
import { Frame } from '../../../art/keys.ts';
import type { PixelRows } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { SkyRacerTex } from '../keys.ts';
import { CloudreachPalette } from './palette.ts';

/** One slot's two wing-beat frames: `a` wings up, `b` wings down. */
type WingBeats = Readonly<Record<typeof Frame.a | typeof Frame.b, PixelRows>>;

/**
 * Bumper the puffin: a white face under a black cap with aviator goggles pushed up on it, a tall
 * orange beak, short black wings.
 */
const BUMPER: WingBeats = {
  [Frame.a]: [
    '..000...........',
    '.02220..........',
    '..02220..0000...',
    '...02220021320..',
    '..00022221101330',
    '.022222221111333',
    '0222222211111330',
    '.0221111111110..',
    '..0111111110....',
    '...000000000....',
    '.....3..3.......',
    '................',
  ],
  [Frame.b]: [
    '................',
    '................',
    '.........0000...',
    '...000000213200.',
    '..02222221101330',
    '.022222221111333',
    '0222222211111330',
    '.0222221111110..',
    '..02222111110...',
    '..0222000000....',
    '..0220..3.3.....',
    '...00...........',
  ],
};

/** Zip the hummingbird: a ruby throat, a needle beak, narrow wings and a forked tail. */
const ZIP: WingBeats = {
  [Frame.a]: [
    '.00.............',
    '.0110...........',
    '..0110....000...',
    '...0110..01110..',
    '....011001101222',
    '...01111113330..',
    '..01111113330...',
    '.0112222220.....',
    '0110000000......',
    '1.1.............',
    '................',
    '................',
  ],
  [Frame.b]: [
    '................',
    '................',
    '..........000...',
    '.........01110..',
    '....000001101222',
    '...01111113330..',
    '..01111113330...',
    '.0101102220.....',
    '0110110000......',
    '1.10110.........',
    '...010..........',
    '....0...........',
  ],
};

/** Dart the swift: a slim body, long sickle wings and a forked tail. */
const DART: WingBeats = {
  [Frame.a]: [
    '..000...........',
    '.01110..........',
    '..001110........',
    '....001110......',
    '1.....00110000..',
    '.1..01111111010.',
    '..1011222222230.',
    '.1..000000000...',
    '1...............',
    '................',
    '................',
    '................',
  ],
  [Frame.b]: [
    '................',
    '................',
    '................',
    '................',
    '1....00000000...',
    '.1..01111111010.',
    '..1011222222230.',
    '.1..0001110000..',
    '1....01110......',
    '...01110........',
    '.01110..........',
    '..000...........',
  ],
};

/** Nox the bat: pointed ears and scalloped wings, lilac bones spread through dark membranes. */
const NOX: WingBeats = {
  [Frame.a]: [
    '0000............',
    '011110000.......',
    '0222211110.0.0..',
    '022122122101010.',
    '022122122111310.',
    '.22022022111110.',
    '.00.00.00022210.',
    '..........0110..',
    '...........00...',
    '................',
    '................',
    '................',
  ],
  [Frame.b]: [
    '................',
    '................',
    '...........0.0..',
    '..........01010.',
    '.00000000111310.',
    '011111111111110.',
    '022122122022210.',
    '022122122.0110..',
    '.220220220.00...',
    '.00.00.00.......',
    '................',
    '................',
  ],
};

/**
 * Pip the flying squirrel: a square gliding membrane between its paws, a big dark eye, a satchel on
 * a strap and a flat tail. The membrane's corners lift in frame `a` and droop in frame `b`.
 */
const PIP: WingBeats = {
  [Frame.a]: [
    '................',
    '.1.......1......',
    '.00......00.....',
    '.010....010.0.0.',
    '.011000011101110',
    '1011111131111010',
    '1011333311112220',
    '.01133311110000.',
    '..022222220.....',
    '...0000000......',
    '................',
    '................',
  ],
  [Frame.b]: [
    '................',
    '................',
    '................',
    '...000000...0.0.',
    '..01111111001110',
    '1011111131111010',
    '1011333311112220',
    '.01133311110000.',
    '.01222222210....',
    '.01000000010....',
    '.00.......00....',
    '.1.........1....',
  ],
};

/** Admiral Pouch the pelican: an admiral's navy hat, a long golden bill over a round pouch, broad wings. */
const POUCH: WingBeats = {
  [Frame.a]: [
    '.00........333..',
    '0110......33333.',
    '.01110...011010.',
    '..01110..0111222',
    '...01110.1102222',
    '..00011100102220',
    '.01111111110000.',
    '011111111110....',
    '.0000000000.....',
    '....2.2.........',
    '................',
    '................',
  ],
  [Frame.b]: [
    '...........333..',
    '..........33333.',
    '.........011010.',
    '.........0111222',
    '..00000001102222',
    '.011111111102220',
    '011111111110000.',
    '01110001110.....',
    '.0011110000.....',
    '...0111102.2....',
    '....01110.......',
    '.....000........',
  ],
};

/** Luna the luna moth: round pale wings with eyespots, feathery antennae and two long tails. */
const LUNA: WingBeats = {
  [Frame.a]: [
    '....00000.......',
    '...0111110......',
    '..011111110....1',
    '..011131110...1.',
    '..01111110...1..',
    '...011110022220.',
    '.0111111102220..',
    '.011311100000...',
    '.0111110........',
    '.110000.........',
    '11..............',
    '3...............',
  ],
  [Frame.b]: [
    '................',
    '................',
    '...............1',
    '..............1.',
    '......00000001..',
    '...011111122220.',
    '..011103333220..',
    '.011101111110...',
    '.01101131110....',
    '.1100111110.....',
    '11...00000......',
    '3...............',
  ],
};

/** Talon the hawk: broad wings with fingered tips, a fan tail and a yellow hooked beak. */
const TALON: WingBeats = {
  [Frame.a]: [
    '1.1.1...........',
    '.1.1.1..........',
    '.01111110.......',
    '..01111110..000.',
    '...011111001010.',
    '0101111111111133',
    '01111111111110.3',
    '0112222222220...',
    '.00000000000....',
    '.....3..3.......',
    '................',
    '................',
  ],
  [Frame.b]: [
    '................',
    '................',
    '................',
    '............000.',
    '..0000000001010.',
    '0101111111111133',
    '01111111111110.3',
    '0110111110220...',
    '.00111111000....',
    '..0111110.3.3...',
    '..011110........',
    '..1.1.1.........',
  ],
};

const WING_BEATS: Record<CharacterId, WingBeats> = {
  rudy: BUMPER,
  gil: ZIP,
  streak: DART,
  onyx: NOX,
  nib: PIP,
  baron: POUCH,
  selene: LUNA,
  rook: TALON,
};

/** Racer sheets, one per slot: frames `a` and `b` are the two beats of the wing stroke. */
export const CLOUDREACH_RACER_SHEETS: readonly ArtSheet<string>[] = CHARACTER_IDS.map((character) =>
  sheet(SkyRacerTex[character], CloudreachPalette[character], WING_BEATS[character]),
);
