/**
 * The solid and decorative course tiles: the earth, cracked stone, branch and mushroom tileset, the chips a
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

const STREAM_STONE_ROWS = [
  '2322222222232222',
  '1112111111112111',
  '1101111101111111',
  '.0000000.000000.',
  ...BRANCH_ROWS.slice(4),
];

/** Vertical grain runs across tile joins, with an offset gouge and a strip of lit wood. */
const OAK_BARK_ROWS = [
  '0112332110112211',
  '0112332110112211',
  '0112332110112211',
  '0112233211012211',
  '0012233211012211',
  '1012233211012211',
  '1012332211011211',
  '1012332110011211',
  '1012332101012211',
  '1012332101122211',
  '0112332101122111',
  '0112322101122111',
  '0112322110112111',
  '0112332110112111',
  '0112332110112211',
  '0112332110112211',
];

const KNOT_RIM_ROWS = [
  '1111122222211111',
  '1112223333222111',
  '1122332222332211',
  '1223221111223221',
  '1223211001123221',
  '1232110000112321',
  '1232100110012321',
  '1232101001012321',
  '1232101001012321',
  '1232100110012321',
  '1232110000112321',
  '1223211001123221',
  '1223221111223221',
  '1122332222332211',
  '1112223333222111',
  '1111122222211111',
];

/** Splintered boards read apart from the forest's thin living branches even before they shake. */
const ROTTEN_WOOD_ROWS = [
  '2222033222220322',
  '1111001111110011',
  '0111101111111011',
  '..0000.00000..00',
  ...BRANCH_ROWS.slice(4),
];

/** An end post and its lashings. Its base meets the deck below this tile. */
const ROPE_POST_ROWS = [
  '................',
  '................',
  '......0220......',
  '......0330......',
  '.....033330.....',
  '.....033330.....',
  '......0120......',
  '......0120......',
  '......0120......',
  '......0120......',
  '......0120......',
  '......0120......',
  '......0120......',
  '......0120......',
  '.....001200.....',
  '.....001200.....',
];

/**
 * A spring mushroom (a bounce cell): a big spotted cap across the top of the tile over a short
 * stem set in dark soil, so one in the floor still reads as ground and a run of them as a bed of
 * caps to land on.
 */
const MUSHROOM_ROWS = [
  '..000000000000..',
  '.01121111121110.',
  '0112221111222110',
  '0111211111121110',
  '0111111221111110',
  '0311111222111130',
  '0331111121111330',
  '0333333333333330',
  '0000002222000000',
  '0000002222000000',
  '0000002222000000',
  '0000002222000000',
  '0000022222200000',
  '0000022222200000',
  '0000222222220000',
  '0000000000000000',
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

/** Terrain sheets. The tileset frames sit in `ForestTile` order. */
export const TERRAIN_SHEETS: readonly ArtSheet<ForestTexKey>[] = [
  {
    key: ForestTex.tiles,
    frames: [
      { name: 'rock', palette: ForestTerrainPalette.earth, rows: EARTH_ROWS },
      { name: 'coral', palette: ForestTerrainPalette.crackedStone, rows: STONE_ROWS },
      { name: 'ledge', palette: ForestTerrainPalette.branch, rows: BRANCH_ROWS },
      { name: 'rockBuried', palette: ForestTerrainPalette.earth, rows: BURIED_EARTH_ROWS },
      { name: 'bounce', palette: ForestTerrainPalette.mushroom, rows: MUSHROOM_ROWS },
      { name: 'streamStone', palette: ForestTerrainPalette.streamStone, rows: STREAM_STONE_ROWS },
      { name: 'oakBark', palette: ForestTerrainPalette.oakBark, rows: OAK_BARK_ROWS },
      { name: 'knotRim', palette: ForestTerrainPalette.knotRim, rows: KNOT_RIM_ROWS },
      { name: 'rottenWood', palette: ForestTerrainPalette.rottenWood, rows: ROTTEN_WOOD_ROWS },
      { name: 'ropePost', palette: ForestTerrainPalette.ropePost, rows: ROPE_POST_ROWS },
    ],
  },
  sheet(ForestTex.stoneDebris, ForestTerrainPalette.crackedStone, {
    [Frame.a]: ['.....00.', '....0120', '.00.010.', '0110.0..', '12110...', '0110..0.', '.00..030', '......0.'],
  }),
  sheet(ForestTex.finishGate, ForestTerrainPalette.finish, { [Frame.a]: FINISH_ROWS }),
];
