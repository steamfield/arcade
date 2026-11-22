/**
 * The eight racers, 16x12 and facing right (the racer view flips them), each
 * drawn around its 12x10 body with two swim-stroke frames, one texture per
 * character. Light comes from the top left like the rest of the art: lit
 * pixels sit on top edges and the dark outline closes every silhouette.
 *
 * `CharacterPalette` holds each character's four colours; the portraits and
 * heads in `ui/portraits.ts` draw in the same palettes, so a racer looks the
 * same in the water, on the strip and on the podium.
 */
import type { CharacterId } from '../../../logic/types.ts';
import { CHARACTER_IDS } from '../../../logic/types.ts';
import { Frame, Tex } from '../keys.ts';
import type { Palette, PixelRows } from '../pixel.ts';
import { type ArtSheet, sheet } from './sheet.ts';

/**
 * Each character's palette: outline, main, light, accent. The main colour holds 3:1 against every
 * water band so the racer reads in any depth (`sprites.test.ts`).
 */
export const CharacterPalette = {
  /** Brass helmet, pale glints, red snapper body behind the porthole. */
  rudy: [0x2a1008, 0xffc040, 0xfff2c0, 0xf05038],
  /** Seahorse green, pale belly plates, deep green ridges. */
  gil: [0x0c2a14, 0x7ad860, 0xe0ffa0, 0x2e8a44],
  /** Electric blue, ice-white belly and sail spots, a yellow lightning stripe. */
  streak: [0x0a1040, 0x3cb8ff, 0xd8f6ff, 0xffe040],
  /** Silver flank, charcoal-black back, a red eye and scar. */
  onyx: [0x06060c, 0xc4cadc, 0x46445e, 0xff3048],
  /** Cream shell, red cleaner stripes, cyan goggle lenses. */
  nib: [0x3a0a14, 0xfff0e2, 0xff4a4a, 0x5ae2ff],
  /** Rust-orange shell, cream barnacles, a gold crown. */
  baron: [0x220a08, 0xf08c50, 0xfff0d0, 0xffd040],
  /** Pale moon bell, white starlight, periwinkle rings and tentacles. */
  selene: [0x241a5c, 0xd0d8ff, 0xffffff, 0x9a8cff],
  /** Shark grey, white belly and teeth, yellow hunter's eyes. */
  rook: [0x0a1626, 0x9aaec4, 0xeef4fa, 0xffd23a],
} as const satisfies Record<CharacterId, Palette>;

/** One character's two swim-stroke frames. */
type Strokes = Readonly<Record<typeof Frame.a | typeof Frame.b, PixelRows>>;

const RUDY: Strokes = {
  [Frame.a]: [
    '................',
    '....0....00000..',
    '...030..0221110.',
    '0.03330021000110',
    '3033330210233010',
    '3333330110303010',
    '0333330110333010',
    '.032220111000110',
    '0.02220111111110',
    '...000.020202020',
    '........0000000.',
    '................',
  ],
  [Frame.b]: [
    '................',
    '....0....00000..',
    '...030..0221110.',
    '..03330021000110',
    '0.33330210233010',
    '3033330110303010',
    '3333330110333010',
    '3032220111000110',
    '3002220111111110',
    '0..000.020202020',
    '........0000000.',
    '................',
  ],
};

const GIL: Strokes = {
  [Frame.a]: [
    '......0.0.......',
    '.....01210......',
    '.....011210000..',
    '....01101111110.',
    '....011110000...',
    '.....011130.....',
    '...20111330.....',
    '..2201111330....',
    '...20111330.....',
    '....0011130.....',
    '......0110.00...',
    '.......00000....',
  ],
  [Frame.b]: [
    '......0.0.......',
    '.....01210......',
    '.....011210000..',
    '....01101111110.',
    '....011110000...',
    '.....011130.....',
    '..220111330.....',
    '...201111330....',
    '..220111330.....',
    '....0011130.....',
    '......01110.....',
    '.......0000.....',
  ],
};

const STREAK: Strokes = {
  [Frame.a]: [
    '..0000..........',
    '..02220.........',
    '...012220.......',
    '....0122200.....',
    '0....011111100..',
    '10..01111111110.',
    '.100113333331111',
    '..0112222222100.',
    '10...000000000..',
    '0...............',
    '................',
    '................',
  ],
  [Frame.b]: [
    '.0000...........',
    '.02220..........',
    '..012220........',
    '....0122200.....',
    '.....011111100..',
    '0...01111111110.',
    '1000113333331111',
    '.10112222222100.',
    '10...000000000..',
    '10..............',
    '0...............',
    '................',
  ],
};

const ONYX: Strokes = {
  [Frame.a]: [
    '................',
    '................',
    '........0.0.....',
    '0...0..02030....',
    '20.0112121220...',
    '2202222222223220',
    '.01111111110000.',
    '20.0111111111110',
    '0...00000000000.',
    '................',
    '................',
    '................',
  ],
  [Frame.b]: [
    '................',
    '................',
    '........0.0.....',
    '....0..02030....',
    '0..0112121220...',
    '2002222222223220',
    '2211111111100000',
    '.0.0111111111110',
    '20..00000000000.',
    '0...............',
    '................',
    '................',
  ],
};

const NIB: Strokes = {
  [Frame.a]: [
    '................',
    '...........1...1',
    '............1.1.',
    '......00000001..',
    '....00222220000.',
    '...021111110330.',
    '..02121211103301',
    '.02111111110000.',
    '0201111111110...',
    '0220.1.1.1.1....',
    '.00.1.1.1.1.....',
    '................',
  ],
  [Frame.b]: [
    '................',
    '..........1....1',
    '...........1.1..',
    '......00000001..',
    '....00222220000.',
    '...021111110330.',
    '..02121211103301',
    '002111111110000.',
    '2201111111110...',
    '000..1.1.1.1....',
    '.....1.1.1.1....',
    '................',
  ],
};

const BARON: Strokes = {
  [Frame.a]: [
    '......3.3.3.....',
    '......33333.....',
    '..1...32323...1.',
    '.1.1.0000000.1.1',
    '1...010111010..1',
    '.1.012111112101.',
    '..1011121111101.',
    '.1..011111110.1.',
    '1..1.0000000.1.1',
    '1...1......1...1',
    '.1..11....11..1.',
    '................',
  ],
  [Frame.b]: [
    '......3.3.3.....',
    '......33333.....',
    '.1....32323..1..',
    '..1..0000000..1.',
    '.1..010111010.1.',
    '1..012111112101.',
    '..1011121111101.',
    '.1..011111110..1',
    '.1.1.0000000.1.1',
    '.1..1......1..1.',
    '1...11....11...1',
    '................',
  ],
};

const SELENE: Strokes = {
  [Frame.a]: [
    '..2.............',
    '.......0000.....',
    '...33..022100...',
    '.33..3102133110.',
    '3......01111110.',
    '..11111031111310',
    '.1.1.11031111310',
    '.......01111110.',
    '.33..3101133110.',
    '3..33..011100...',
    '.......0000...2.',
    '................',
  ],
  [Frame.b]: [
    '................',
    '.2.....0000.....',
    '.33..3.022100...',
    '3..33.102133110.',
    '.......01111110.',
    '.1111.1031111310',
    '1.1.1.1031111310',
    '.......01111110.',
    '3..33.101133110.',
    '.33..3.011100...',
    '.......0000.....',
    '....2...........',
  ],
};

const ROOK: Strokes = {
  [Frame.a]: [
    '.....0......00..',
    '....010....0130.',
    '0...0110...0110.',
    '10.011100..0110.',
    '110011111111110.',
    '.011111111111110',
    '.011111111111110',
    '102222222222210.',
    '110002222200110.',
    '10..00000..0110.',
    '0..........0130.',
    '............00..',
  ],
  [Frame.b]: [
    '.....0......00..',
    '....010....0130.',
    '....0110...0110.',
    '0..011100..0110.',
    '100011111111110.',
    '1101111111111110',
    '.011111111111110',
    '.02222222222210.',
    '100002222200110.',
    '11..00000..0110.',
    '10.........0130.',
    '0...........00..',
  ],
};

const STROKES: Record<CharacterId, Strokes> = {
  rudy: RUDY,
  gil: GIL,
  streak: STREAK,
  onyx: ONYX,
  nib: NIB,
  baron: BARON,
  selene: SELENE,
  rook: ROOK,
};

/** Racer sheets, one per character: frame `a` and `b` are the two strokes of the swim cycle. */
export const RACER_SHEETS: readonly ArtSheet[] = CHARACTER_IDS.map((character) =>
  sheet(Tex[character], CharacterPalette[character], STROKES[character]),
);
