/**
 * The solid and decorative course tiles: the tileset (rock, coral, the sky and
 * cave tiles drawn in `surface.ts` and `cave.ts`, the ledge and a bounce cloud), coral debris,
 * swaying kelp and the finish banner. Tiles are 16x16 and seamless, since the same tile
 * repeats across whole walls and kelp beds.
 */
import { Frame } from '../../../art/keys.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { OceanTex, type OceanTexKey } from '../keys.ts';
import { TerrainPalette } from '../palettes.ts';
import { CAVE_TILES } from './cave.ts';
import { SHELL_TILES } from './shell.ts';
import { SKY_TILE } from './surface.ts';

/** Branch strip for ledges: dark underside, bark, lit top. Wood, so it reads apart from rock and coral. */
const BRANCH_PALETTE = [0x3a2414, 0x6b4423, 0x9a6a38] as const;

/** A ledge tile: a four-pixel branch along the top of an otherwise empty tile, so racers can jump up through it. */
const LEDGE_ROWS = [
  '2222122222221222',
  '1111111211111112',
  '1011111111101111',
  '0000000000000000',
  ...Array.from({ length: 12 }, () => '................'),
];

/** A bounce cloud's colours: shade, pale body, highlight, and the blue coil that says "spring". */
const BOUNCE_PALETTE = [0x9aa8d8, 0xe2eafa, 0xffffff, 0x6474b8] as const;

/**
 * A bounce cloud tile: two puffy lumps on top over a pale body with a zigzag coil through it, so a
 * row of them reads as one soft, springy block. Seamless left to right.
 */
const BOUNCE_ROWS = [
  '..22222...22222.',
  '.2222222.2222222',
  '2221122222211222',
  '2111111221111112',
  '1111111111111111',
  '1111111111111111',
  '1111111111111111',
  '3111311131113111',
  '1313131313131313',
  '1131113111311131',
  '1111111111111111',
  '1111111111111111',
  '1111111111111111',
  '0111011101110111',
  '0010001000100010',
  '0000000000000000',
];

/** Coral's tile: branching stems in four tones, seamless both ways. */
const CORAL_ROWS = [
  '2211001122110011',
  '2100011221000112',
  '1103112211001122',
  '1100112211001122',
  '2110011221100112',
  '2211001122110011',
  '1221100112231001',
  '1221100112211001',
  '1221100112211001',
  '1221100112211001',
  '1122110011221100',
  '0112213001122110',
  '0011221100112211',
  '0011221100112231',
  '0012211000122110',
  '1122110011221100',
];

/**
 * Terrain sheets. The tileset frames sit in `OceanTile` order: rock, coral, sky, the cave tiles, the
 * ledge, the bounce cloud and the four shell tiles.
 */
export const TERRAIN_SHEETS: readonly ArtSheet<OceanTexKey>[] = [
  {
    key: OceanTex.tiles,
    frames: [
      {
        name: 'rock',
        palette: TerrainPalette.rock,
        rows: [
          '0333000333111000',
          '3111003111111033',
          '1111102111110001',
          '1111100111003100',
          '0111100010331110',
          '0000033003111111',
          '1033311100111111',
          '1021111100001111',
          '0311111102300001',
          '0111111031113300',
          '0001111021111103',
          '1300000001111102',
          '1113033300111031',
          '1111021110000311',
          '1111021111000211',
          '1000011000330011',
        ],
      },
      { name: 'coral', palette: TerrainPalette.coral, rows: CORAL_ROWS },
      SKY_TILE,
      ...CAVE_TILES,
      { name: 'ledge', palette: BRANCH_PALETTE, rows: LEDGE_ROWS },
      { name: 'bounce', palette: BOUNCE_PALETTE, rows: BOUNCE_ROWS },
      ...SHELL_TILES,
    ],
  },
  sheet(OceanTex.coralDebris, TerrainPalette.coral, {
    [Frame.a]: ['.....00.', '....0120', '.00.010.', '0110.0..', '12110...', '0110..0.', '.00..030', '......0.'],
  }),
  sheet(OceanTex.kelp, TerrainPalette.kelp, {
    [Frame.a]: [
      '...012....210...',
      '...0122...2101..',
      '....0121..210.0.',
      '....012...210...',
      '....012....210..',
      '...1012...2210..',
      '..0012...1.210..',
      '...012.....210..',
      '...012....210...',
      '...0122...2101..',
      '..012..1..210.0.',
      '..012.....210...',
      '..012....210....',
      '.1012...2210....',
      '0..012.1.210....',
      '...012...210....',
    ],
    [Frame.b]: [
      '....012....210..',
      '...1012...2210..',
      '..0012...1.210..',
      '...012.....210..',
      '...012....210...',
      '...0122...2101..',
      '..012..1..210.0.',
      '..012.....210...',
      '..012....210....',
      '.1012...2210....',
      '0..012.1.210....',
      '...012...210....',
      '...012....210...',
      '...0122...2101..',
      '....0121..210.0.',
      '....012...210...',
    ],
  }),
  sheet(OceanTex.finishGate, TerrainPalette.finish, {
    [Frame.a]: [
      '...00222211110..',
      '...00222211110..',
      '...00222211110..',
      '...00222211110..',
      '...00111122220..',
      '...00111122220..',
      '...00111122220..',
      '...00111122220..',
      '...00222211110..',
      '...00222211110..',
      '...00222211110..',
      '...00222211110..',
      '...00111122220..',
      '...00111122220..',
      '...00111122220..',
      '...00111122220..',
    ],
  }),
];
