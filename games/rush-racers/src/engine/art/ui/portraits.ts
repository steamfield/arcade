/**
 * The racers' faces in each character's own palette (`CharacterPalette` in
 * `sprites/racers.ts`): 16x16 portraits for the place panel, the select grid
 * and the podium, and 7x7 heads for the progress strip and the standings
 * (pixel art never scales by fractions, so the small size is drawn on its own).
 *
 * The heads ride side by side on the strip, so each has its own outline shape
 * and still tells apart in grayscale: a round helmet, a coronet and snout, a
 * sail and bill, a jaw wedge, goggles under antennae, a crown, a dome over
 * tentacles and a hammer bar. Light comes from the top left, as in the world art.
 */
import type { CharacterId } from '../../../logic/types.ts';
import { CHARACTER_IDS } from '../../../logic/types.ts';
import type { PixelRows } from '../pixel.ts';
import { CharacterPalette } from '../sprites/racers.ts';
import { PortraitFrame, type UiSheet, UiTex } from './keys.ts';

/** One character's face at both sizes. */
interface Face {
  head: PixelRows;
  portrait: PixelRows;
}

const FACES: Record<CharacterId, Face> = {
  /** The brass helmet head-on, his grin and wide eyes behind the porthole, a bolted collar. */
  rudy: {
    head: ['.00000.', '0221110', '0200010', '0203010', '0200010', '0212120', '.00000.'],
    portrait: [
      '....00000000....',
      '..002211111100..',
      '.02211111111110.',
      '0221100000011110',
      '0211023333301110',
      '0110323333330110',
      '0110320332030110',
      '0110320332030110',
      '0110333333330110',
      '0110330330330110',
      '0111033003301110',
      '0111100000011110',
      '.01111111111110.',
      '.00000000000000.',
      '0212121212121210',
      '0000000000000000',
    ],
  },
  /** Side-on, facing right: the coronet, a long snout, a bright eye and a ridged neck with a fin. */
  gil: {
    head: ['.00....', '021000.', '0101110', '011000.', '.0130..', '.01130.', '..000..'],
    portrait: [
      '.....0.0.0......',
      '....0212120.....',
      '...011111110....',
      '..0121111110....',
      '..02111201100000',
      '.011111221111110',
      '.011111111000000',
      '.01111111130....',
      '..0111111330....',
      '...01111320.....',
      '..201111320.....',
      '.22011111320....',
      '..20111111320...',
      '...0111111320...',
      '....011111320...',
      '.....0111320....',
    ],
  },
  /** Side-on, facing right: the swept sail, a cocky brow, the long bill and a lightning stripe. */
  streak: {
    head: ['00.....', '0220...', '.0120..', '.01110.', '0131111', '.02220.', '..000..'],
    portrait: [
      '0000............',
      '02120...........',
      '012120..........',
      '0121220.........',
      '.0121220........',
      '.01212220000....',
      '..011111111110..',
      '..0111110001110.',
      '.01111111201110.',
      '.011111112211111',
      '.011333333110000',
      '.0111111111110..',
      '..022222222220..',
      '...0222222220...',
      '....00000000....',
      '................',
    ],
  },
  /** Side-on, facing right: a scowl over the red eye, the underbite with its teeth, the torn fin. */
  onyx: {
    head: ['.......', '.0.0...', '02020..', '0222320', '0111000', '0111110', '.00000.'],
    portrait: [
      '................',
      '..0.0...........',
      '.02030..........',
      '.022230.........',
      '.02222200000....',
      '.0222222222220..',
      '.02122220002220.',
      '.022222220332220',
      '.022222222222220',
      '.011111111000000',
      '.011111111010101',
      '.011111111111110',
      '..01111111111110',
      '...0000000000000',
      '................',
      '................',
    ],
  },
  /** Head-on: two big goggle lenses under the long antennae, red-and-white stripes, a grin. */
  nib: {
    head: ['1.....1', '.1...1.', '.02120.', '0330330', '0330330', '.01110.', '..000..'],
    portrait: [
      '.1............1.',
      '..1..........1..',
      '...1........1...',
      '....10000001....',
      '...0222112220...',
      '.00000011000000.',
      '0033330110333300',
      '0013330110133300',
      '0033330110333300',
      '.00000011000000.',
      '..011111111110..',
      '..011011110110..',
      '...0110000110...',
      '....01111110....',
      '.....000000.....',
      '................',
    ],
  },
  /** Head-on: the barnacle-crusted crown, eyes looking right, a frown and both claws up. */
  baron: {
    head: ['.3.3.3.', '.33333.', '0000000', '0101010', '0111110', '1011101', '1.000.1'],
    portrait: [
      '...3...33...3...',
      '...33.3333.33...',
      '...3232332323...',
      '...3333333333...',
      '..011111111110..',
      '.01201111112010.',
      '0111211111121110',
      '0111110000111110',
      '0111101111011110',
      '.01111111111110.',
      '.0.0000000000.0.',
      '010.1.1..1.1.010',
      '0110........0110',
      '0.10........01.0',
      '0110........0110',
      '.00..........00.',
    ],
  },
  /** Head-on: the moon bell with its four rings, closed eyes and a calm smile, trailing arms and stars. */
  selene: {
    head: ['..000..', '.02110.', '0213110', '0131310', '0000000', '.3.3.3.', '3.3.3..'],
    portrait: [
      '.2...000000.....',
      '...0022111100.2.',
      '..022113311110..',
      '.02113311331110.',
      '.01111133111110.',
      '0111111111111110',
      '0111001111001110',
      '0111111111111110',
      '0111111001111110',
      '.00000000000000.',
      '.3..3.1111.3..3.',
      '3..3..1111..3..3',
      '.3..3.1111.3..3.',
      '..3..3.11.3..3..',
      '.3..3..11..3..3.',
      '..............2.',
    ],
  },
  /** Head-on: the hammer bar with a yellow eye at each end and a wide grin full of teeth. */
  rook: {
    head: ['0000000', '3111113', '0011100', '.01110.', '.02020.', '.02220.', '..000..'],
    portrait: [
      '................',
      '.00000000000000.',
      '0332111111111330',
      '0301111111111030',
      '.00011111111000.',
      '...0111111110...',
      '...0111111110...',
      '..011111111110..',
      '..011111111110..',
      '..010000000010..',
      '..012020202010..',
      '...0110000110...',
      '...0222222220...',
      '....00000000....',
      '................',
      '................',
    ],
  },
};

/** One sheet frame per character, named by `PortraitFrame`, drawn in that character's palette. */
function framesOf(size: keyof Face) {
  return CHARACTER_IDS.map((character) => ({
    name: PortraitFrame[character],
    palette: CharacterPalette[character],
    rows: FACES[character][size],
  }));
}

/** The portrait and head sheets, one frame per character in each, named by `PortraitFrame`. */
export const PORTRAIT_SHEETS: readonly UiSheet[] = [
  { key: UiTex.heads, frames: framesOf('head') },
  { key: UiTex.portraits, frames: framesOf('portrait') },
];
