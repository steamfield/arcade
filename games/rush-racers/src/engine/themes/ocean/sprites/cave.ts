/**
 * Cave art: the cave stone tiles a course names in its legend (plain cave rock, a stalactite
 * hanging from the rock above and a stalagmite rising from the rock below), and the dark wall
 * tiled behind a dark stretch so it reads as the inside of a cave. The stone is darker and bluer
 * than reef rock; the wall is darker still, a faint crack across near-black stone.
 */

import { Frame } from '../../../art/keys.ts';
import type { NamedFrame, PixelRows } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { OceanTex, type OceanTexKey } from '../keys.ts';
import { BackdropPalette, TerrainPalette } from '../palettes.ts';

/** A stalactite, full width where it meets the rock above and tapering to a point; lit on its left. */
const STALACTITE_ROWS: PixelRows = [
  '0322222211111100',
  '0322222211111100',
  '.03222221111100.',
  '.0322222111100..',
  '..032222111100..',
  '..03222211100...',
  '...0322211100...',
  '...032221100....',
  '....0322100.....',
  '....032210......',
  '.....03210......',
  '.....0320.......',
  '......030.......',
  '......00........',
  '......0.........',
  '................',
];

/** Cave tiles for the tileset, in `OceanTile` order after the sky: cave rock, stalactite, stalagmite. */
export const CAVE_TILES: readonly NamedFrame[] = [
  {
    name: 'caveRock',
    palette: TerrainPalette.caveStone,
    rows: [
      '0111110011111100',
      '1222211012222110',
      '1233221012332210',
      '1222211001222100',
      '0111110000111000',
      '0011100111100111',
      '1110001222210122',
      '2211012233221012',
      '2221012222221012',
      '1110001222210011',
      '0000110111100111',
      '0111221000001222',
      '1223321011101233',
      '1222221012210122',
      '0111110012210011',
      '0000000001100000',
    ],
  },
  { name: 'stalactite', palette: TerrainPalette.caveStone, rows: STALACTITE_ROWS },
  // The same cone stood on its base, so the pair read as one formation dripping and growing.
  { name: 'stalagmite', palette: TerrainPalette.caveStone, rows: [...STALACTITE_ROWS].reverse() },
];

/** The cave wall sheet, one seamless 16x16 frame. */
export const CAVE_SHEETS: readonly ArtSheet<OceanTexKey>[] = [
  sheet(OceanTex.caveWall, BackdropPalette.caveWall, {
    [Frame.a]: [
      '1111101111111211',
      '1121100111111111',
      '1111110011121111',
      '1111111001111111',
      '2111111100111112',
      '1111211110011111',
      '1111111111001111',
      '0011111111100111',
      '1001112111110011',
      '1100111111111001',
      '1110011111211100',
      '1111001111111110',
      '1211100111111111',
      '1111110011112111',
      '1111111001111111',
      '1111111100111111',
    ],
  }),
];
