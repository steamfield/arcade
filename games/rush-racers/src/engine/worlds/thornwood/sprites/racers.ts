/**
 * Thornwood's eight racers, 16x12 and facing right (the racer view flips them), each drawn around
 * the same 12x10 body as Reef's racers with two run-stride frames, one texture per slot. Light
 * comes from the top left: lit pixels sit on top edges, the second colour is the pale face, belly
 * or glint, and a dark outline closes each body. Thin limbs (legs, tails, whiskers) are 1 px
 * unoutlined lines in a body colour, so they stay thin. In frame `a` the legs stretch fore and
 * aft; in frame `b` they gather under the body, which reads as a two-step run.
 *
 * `ThornwoodPalette` holds each slot's four colours; the portraits and heads in `portraits.ts`
 * draw in the same palettes, so a critter looks the same on the course, on the strip and on the
 * select screen.
 */
import type { CharacterId } from '../../../../logic/types.ts';
import { CHARACTER_IDS } from '../../../../logic/types.ts';
import { Frame } from '../../../art/keys.ts';
import type { Palette, PixelRows } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { ThornRacerTex } from '../keys.ts';

/**
 * Each slot's palette: outline, main, second, accent. The main colour holds 3:1 against every
 * theme's contrast bands so the critter reads in any light (`sprites.test.ts`). The second is the
 * other body tone: a pale face, belly or glint for most, but Shade's charcoal coat, the one second
 * colour darker than its main.
 */
export const ThornwoodPalette = {
  /** Badger: grey coat, pale face stripe and lamp glass, an orange miner's helmet. */
  rudy: [0x1a1420, 0xb8bcc8, 0xfff4c8, 0xff9a28],
  /** Hare: sandy coat, cream belly and tail, pink inner ears. */
  gil: [0x2c1a0c, 0xe0b880, 0xfff2dc, 0xff8a9c],
  /** Fox: bright orange coat, cream chest and tail tip, dark socks and ear tips. */
  streak: [0x2e0e06, 0xff7a30, 0xfff0d4, 0x5a2410],
  /** Panther cub: a charcoal coat with a lilac sheen on its lit edges and belly, green-gold eyes. */
  onyx: [0x07060e, 0xb4a4ec, 0x3c3858, 0xd8ff3c],
  /** Chipmunk: tawny coat, cream stripes and belly, cyan goggle lenses. */
  nib: [0x34180a, 0xf0b468, 0xfff0d8, 0x5ae2ff],
  /** Tortoise: moss-green shell, tan skin, a gold crown. */
  baron: [0x10260c, 0x92d058, 0xe8d49a, 0xffd23c],
  /** Owl: tawny feathers, a cream face and belly, a rose scarf. */
  selene: [0x28160c, 0xd8aa66, 0xfff0d2, 0xe8446e],
  /** Wolf: grey fur, pale muzzle and belly, yellow hunter's eyes. */
  rook: [0x10141e, 0x9aa8bc, 0xeaf0f8, 0xffd23a],
} as const satisfies Record<CharacterId, Palette>;

/** One slot's two run-stride frames. */
type Strides = Readonly<Record<typeof Frame.a | typeof Frame.b, PixelRows>>;

const RUDY: Strides = {
  [Frame.a]: [
    '..........000...',
    '.........03330..',
    '........0333332.',
    '..00000.00000000',
    '.01111110222220.',
    '.01111110202220.',
    '.01111111022220.',
    '.01221111111000.',
    '..0222222200....',
    '..11.0..0.11....',
    '.1....1.1....1..',
    '................',
  ],
  [Frame.b]: [
    '..........000...',
    '.........03330..',
    '........0333332.',
    '..00000.00000000',
    '.01111110222220.',
    '.01111110202220.',
    '.01111111022220.',
    '.01221111111000.',
    '..0222222200....',
    '...1.1...1.1....',
    '...1.1...1.1....',
    '................',
  ],
};

const GIL: Strides = {
  [Frame.a]: [
    '.........0.0....',
    '........0301....',
    '........0301....',
    '........0110....',
    '..00000.0111100.',
    '.0222210011110..',
    '.022211111111...',
    '.0111111111100..',
    '..0111111000....',
    '..1..0...1......',
    '.1....1..1......',
    '................',
  ],
  [Frame.b]: [
    '.........0.0....',
    '........0301....',
    '........0301....',
    '........0110....',
    '..00000.0111100.',
    '.0222210011110..',
    '.022211111111...',
    '.0111111111100..',
    '..0111111000....',
    '...1.0....1.....',
    '....1.....1.....',
    '................',
  ],
};

const STREAK: Strides = {
  [Frame.a]: [
    '.........0.0....',
    '........03130...',
    '..000...0111100.',
    '.012100.01121113',
    '.012211111111110',
    '..0111111111100.',
    '...0111112211100',
    '....000000000...',
    '...1.....1..1...',
    '..1......1...1..',
    '..1......1...1..',
    '................',
  ],
  [Frame.b]: [
    '.........0.0....',
    '........03130...',
    '..000...0111100.',
    '.012100.01121113',
    '.012211111111110',
    '..0111111111100.',
    '...0111112211100',
    '....000000000...',
    '....1...1.1.....',
    '....1...1.1.....',
    '....1...1.1.....',
    '................',
  ],
};

const ONYX: Strides = {
  [Frame.a]: [
    '................',
    '.........00.00..',
    '........0110110.',
    '1...0000.0111110',
    '10.0111110222320',
    '.100222222222220',
    '..0022222222220.',
    '...0111111111100',
    '....00000000000.',
    '...1....1...1...',
    '..1....1.....1..',
    '................',
  ],
  [Frame.b]: [
    '................',
    '.........00.00..',
    '........0110110.',
    '.1..0000.0111110',
    '10.0111110222320',
    '.100222222222220',
    '..0022222222220.',
    '...0111111111100',
    '....00000000000.',
    '....1.1...1.....',
    '....1.1...1.....',
    '................',
  ],
};

const NIB: Strides = {
  [Frame.a]: [
    '................',
    '.00.......00110.',
    '0110.0000.01110.',
    '0110011110033330',
    '100112121103330.',
    '.01112121211110.',
    '.01111111111120.',
    '..011111111100..',
    '...00000000.....',
    '...1..1..1.1....',
    '..1....1...1....',
    '................',
  ],
  [Frame.b]: [
    '................',
    '.00.......00110.',
    '0110.0000.01110.',
    '0110011110033330',
    '100112121103330.',
    '.01112121211110.',
    '.01111111111120.',
    '..011111111100..',
    '...00000000.....',
    '....1.1....1....',
    '....1.1....1....',
    '................',
  ],
};

const BARON: Strides = {
  [Frame.a]: [
    '................',
    '............3.3.',
    '..000000...33333',
    '.0111111100.0220',
    '0111211211100220',
    '0111121112111020',
    '.01111111111000.',
    '..00000000000...',
    '..2..2....2..2..',
    '..2.2......2.2..',
    '................',
    '................',
  ],
  [Frame.b]: [
    '................',
    '............3.3.',
    '..000000...33333',
    '.0111111100.0220',
    '0111211211100220',
    '0111121112111020',
    '.01111111111000.',
    '..00000000000...',
    '...22..22.22....',
    '...22..22.22....',
    '................',
    '................',
  ],
};

const SELENE: Strides = {
  [Frame.a]: [
    '....00....00....',
    '...0110..0110...',
    '..011111111110..',
    '.0112221222110..',
    '.0112021202110..',
    '.0111111001110..',
    '33.3333333333...',
    '.3..0122222210..',
    '.....01222210...',
    '.....000000.....',
    '....1.1..1.1....',
    '................',
  ],
  [Frame.b]: [
    '....00....00....',
    '...0110..0110...',
    '..011111111110..',
    '.0112221222110..',
    '.0112021202110..',
    '.0111111001110..',
    '.3333333333333..',
    '33..0122222210..',
    '.....01222210...',
    '.....000000.....',
    '.....1..1.......',
    '................',
  ],
};

const ROOK: Strides = {
  [Frame.a]: [
    '.........0.0....',
    '........01010...',
    '........0111110.',
    '..00000.01131110',
    '.011111001122220',
    '.01111111111120.',
    '.0111111111110..',
    '.0122222221110..',
    '..0000000000....',
    '..1..1....1..1..',
    '.1....1...1...1.',
    '................',
  ],
  [Frame.b]: [
    '.........0.0....',
    '........01010...',
    '........0111110.',
    '..00000.01131110',
    '.011111001122220',
    '.01111111111120.',
    '.0111111111110..',
    '.0122222221110..',
    '..0000000000....',
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

/** Racer sheets, one per slot: frames `a` and `b` are the two strides of the run cycle. */
export const THORNWOOD_RACER_SHEETS: readonly ArtSheet<string>[] = CHARACTER_IDS.map((character) =>
  sheet(ThornRacerTex[character], ThornwoodPalette[character], STRIDES[character]),
);
