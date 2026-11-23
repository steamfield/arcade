/**
 * The solid and decorative course tiles: the earth, cracked stone and branch tileset, the chips a
 * broken stone tile scatters and the finish banner. Tiles are 16x16 and seamless sideways, since the
 * same tile repeats across whole walls.
 */
import { Frame } from '../../../art/keys.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { ForestTex, type ForestTexKey } from '../keys.ts';
import { ForestTerrainPalette } from '../palettes.ts';

/** Earth: a grass top with a ragged lower edge, then soil flecked with lit soil and deep pockets. */
const EARTH_ROWS = [
  '3333333333333333',
  '3313331333313331',
  '1012111111011211',
  '1111211111111121',
  '1111211111111121',
  '1101111211111111',
  '1111111111211011',
  '2111011111111111',
  '1111111112111121',
  '1011211111110111',
  '1111111101111111',
  '1121111111121101',
  '1111011211111111',
  '1111111111101211',
  '0110111121111111',
  '1111211111011101',
];

/** Earth with more earth over it: the same soil as `EARTH_ROWS` with no grass, so deep ground doesn't stripe. */
const BURIED_EARTH_ROWS = ['1111111121111111', '1121111111110111', ...EARTH_ROWS.slice(2)];

/** Cracked stone: lit faces split by dark cracks, with moss in the seams. Grey and cool, so it reads apart from earth. */
const STONE_ROWS = [
  '1111112111111111',
  '1221111111111211',
  '1111110111122111',
  '1111101111111111',
  '1311001111111211',
  '1111101111111111',
  '1111110011111111',
  '2111111011122111',
  '1111111101111111',
  '1111110011111311',
  '1112111011111111',
  '1111111001111211',
  '1311111100111111',
  '1111211111011111',
  '1111111111101111',
  '1111111211110111',
];

/** A ledge tile: a four-pixel branch along the top of an otherwise empty tile, so racers can jump up through it. */
const BRANCH_ROWS = [
  '2222122222221222',
  '1111111211111112',
  '1011111111101111',
  '0000000000000000',
  ...Array.from({ length: 12 }, () => '................'),
];

/** The checkered finish banner on a post. */
const FINISH_ROWS = [
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
];

/** Terrain sheets. The tileset frames sit in `ForestTile` order: earth, stone, the branch, then buried earth. */
export const TERRAIN_SHEETS: readonly ArtSheet<ForestTexKey>[] = [
  {
    key: ForestTex.tiles,
    frames: [
      { name: 'rock', palette: ForestTerrainPalette.earth, rows: EARTH_ROWS },
      { name: 'coral', palette: ForestTerrainPalette.crackedStone, rows: STONE_ROWS },
      { name: 'ledge', palette: ForestTerrainPalette.branch, rows: BRANCH_ROWS },
      { name: 'rockBuried', palette: ForestTerrainPalette.earth, rows: BURIED_EARTH_ROWS },
    ],
  },
  sheet(ForestTex.stoneDebris, ForestTerrainPalette.crackedStone, {
    [Frame.a]: ['.....00.', '....0120', '.00.010.', '0110.0..', '12110...', '0110..0.', '.00..030', '......0.'],
  }),
  sheet(ForestTex.finishGate, ForestTerrainPalette.finish, { [Frame.a]: FINISH_ROWS }),
];
