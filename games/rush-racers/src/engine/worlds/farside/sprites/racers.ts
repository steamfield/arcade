/**
 * Farside's eight racers, 16x12 and facing right (the racer view flips them), one texture per
 * slot. Light comes from the top left. The outline is near-black and disappears against the space
 * sky, so every part that has to read (limbs, antennae, eyes, flames) is drawn in the main, second
 * or accent colour and thin parts are 1 px lines without an outline. Frames `a` and `b` are the two
 * beats of each racer's motion: a thruster or tail flame that flickers long and short, a sparkle
 * that jumps, or legs that stretch fore and aft and then gather under the body.
 *
 * Colours come from `palette.ts`, shared with the portraits and heads.
 */
import type { CharacterId } from '../../../../logic/types.ts';
import { CHARACTER_IDS } from '../../../../logic/types.ts';
import { Frame } from '../../../art/keys.ts';
import type { PixelRows } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { FarRacerTex } from '../keys.ts';
import { FarsidePalette } from './palette.ts';

/** One slot's two motion frames. */
type Strides = Readonly<Record<typeof Frame.a | typeof Frame.b, PixelRows>>;

/** Bolt: a boxy red robot with two dents, a glass dome over a glowing bulb and a yellow visor; its back thruster flares long, then short. */
const RUDY: Strides = {
  [Frame.a]: [
    '.......0000.....',
    '......022220....',
    '......023220....',
    '....0000000000..',
    '....0111111110..',
    '....0111111330..',
    '33220111111110..',
    '.3320111011110..',
    '....0111111010..',
    '....0000000000..',
    '......1...1.....',
    '.....11..11.....',
  ],
  [Frame.b]: [
    '.......0000.....',
    '......022220....',
    '......023220....',
    '....0000000000..',
    '....0111111110..',
    '....0111111330..',
    '..320111111110..',
    '...30111011110..',
    '....0111111010..',
    '....0000000000..',
    '......1...1.....',
    '.....11..11.....',
  ],
};

/** Zib: a small green head with one big pale eye and pink-tipped antennae on long thin legs, striding wide and then together. */
const GIL: Strides = {
  [Frame.a]: [
    '.....3....3.....',
    '......1..1......',
    '.....000000.....',
    '....01111110....',
    '....01112220....',
    '....01112020....',
    '....01122110....',
    '.....011110.....',
    '.....1....1.....',
    '....1......1....',
    '...1........1...',
    '..11........11..',
  ],
  [Frame.b]: [
    '.....3....3.....',
    '......1..1......',
    '.....000000.....',
    '....01111110....',
    '....01112220....',
    '....01112020....',
    '....01122110....',
    '.....011110.....',
    '......1..1......',
    '......1..1......',
    '......1..1......',
    '.....11..11.....',
  ],
};

/** Flare: a round blue alien with a white eye, trailing a comet tail of white-hot core and orange sparks that flickers between two shapes. */
const STREAK: Strides = {
  [Frame.a]: [
    '................',
    '..........00000.',
    '.........0111110',
    '..3....330111220',
    '.3.3332220111110',
    '3332222221111110',
    '.3.3332220111110',
    '..3....33.01110.',
    '...........000..',
    '...........1.1..',
    '................',
    '................',
  ],
  [Frame.b]: [
    '................',
    '..........00000.',
    '.........0111110',
    '....3..330111220',
    '..33.32220111110',
    '.333222221111110',
    '..33.32220111110',
    '....3..33.01110.',
    '...........000..',
    '..........1...1.',
    '................',
    '................',
  ],
};

/** Umbra: a flat stealth drone, a charcoal hull with a teal sheen on its top and rims and one amber eye at the nose; teal exhaust flickers behind. */
const ONYX: Strides = {
  [Frame.a]: [
    '................',
    '................',
    '................',
    '.........111....',
    '.......0011100..',
    '.....00111111100',
    '1.10011122222330',
    '1101112222222210',
    '...01222222210..',
    '....0111111110..',
    '.....00000000...',
    '................',
  ],
  [Frame.b]: [
    '................',
    '................',
    '................',
    '.........111....',
    '.......0011100..',
    '.....00111111100',
    '..10011122222330',
    '.101112222222210',
    '...01222222210..',
    '....0111111110..',
    '.....00000000...',
    '................',
  ],
};

/** Widget: a tiny lilac alien in mint goggles with a cream backpack whose jet puffs mint under it while its short legs step. */
const NIB: Strides = {
  [Frame.a]: [
    '................',
    '................',
    '.......0000.....',
    '......011110....',
    '.....01111110...',
    '.....01133330...',
    '..00001111110...',
    '..02220111110...',
    '..02320111110...',
    '..02220111110...',
    '..0000.1...1....',
    '..333...........',
  ],
  [Frame.b]: [
    '................',
    '................',
    '.......0000.....',
    '......011110....',
    '.....01111110...',
    '.....01133330...',
    '..00001111110...',
    '..02220111110...',
    '..02320111110...',
    '..02220111110...',
    '..0000..1.1.....',
    '...3............',
  ],
};

/** Admiral Crater: a huge cratered moon-rock golem filling the frame, a crown of three red-tipped antennae and one red eye, on two stomping legs. */
const BARON: Strides = {
  [Frame.a]: [
    '...3...3...3....',
    '...1...1...1....',
    '..00000000000...',
    '.01121111111110.',
    '.01111111221110.',
    '0111221111113110',
    '0111221111111110',
    '0111111112211110',
    '0121111112211110',
    '.01111111111110.',
    '..111.....111...',
    '.1111.....1111..',
  ],
  [Frame.b]: [
    '...3...3...3....',
    '...1...1...1....',
    '..00000000000...',
    '.01121111111110.',
    '.01111111221110.',
    '0111221111113110',
    '0111221111111110',
    '0111111112211110',
    '0121111112211110',
    '.01111111111110.',
    '..111.....1111..',
    '.1111...........',
  ],
};

/** Nova: a five-pointed yellow star with a white-hot core and a small face, its two lower points striding while the core swells and pink sparkles jump. */
const SELENE: Strides = {
  [Frame.a]: [
    '............3...',
    '.......0........',
    '..3...010.......',
    '......010.......',
    '.00000121000000.',
    '.0111122211110..',
    '...011020110....',
    '....0112110.....',
    '.3..0111110.....',
    '...011101110....',
    '..0110...0110.3.',
    '..11.......11...',
  ],
  [Frame.b]: [
    '................',
    '...3...0........',
    '......010....3..',
    '......010.......',
    '.00000121000000.',
    '.0111122211110..',
    '3..011020110....',
    '....0122210.....',
    '....0111110.....',
    '....0110110.....',
    '....011.110.....',
    '.....1...1...3..',
  ],
};

/** Krag: a hunched grey raider with pale spikes along its back, a red visor and pale fangs, striding wide and then together. */
const ROOK: Strides = {
  [Frame.a]: [
    '................',
    '...2...2...0000.',
    '..222.222.011110',
    '.000000000011330',
    '0111111111111110',
    '0121112111211110',
    '0111111111112220',
    '.01111111111110.',
    '..000000000000..',
    '..1..1....1..1..',
    '.1....1...1...1.',
    '................',
  ],
  [Frame.b]: [
    '................',
    '...2...2...0000.',
    '..222.222.011110',
    '.000000000011330',
    '0111111111111110',
    '0121112111211110',
    '0111111111112220',
    '.01111111111110.',
    '..000000000000..',
    '...1.1....1.1...',
    '...1.1....1.1...',
    '................',
  ],
};

const STRIDES: Record<CharacterId, Strides> = {
  rudy: RUDY,
  gil: GIL,
  streak: STREAK,
  onyx: ONYX,
  nib: NIB,
  baron: BARON,
  selene: SELENE,
  rook: ROOK,
};

/** Racer sheets, one per slot: frames `a` and `b` are the two beats of its motion. */
export const FARSIDE_RACER_SHEETS: readonly ArtSheet<string>[] = CHARACTER_IDS.map((character) =>
  sheet(FarRacerTex[character], FarsidePalette[character], STRIDES[character]),
);
