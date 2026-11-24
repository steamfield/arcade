/**
 * The solid and decorative course tiles: the asteroid rock, breakable ice and strut tileset, the
 * chips a broken ice tile scatters and the finish gate. Tiles are 16x16 and seamless sideways, since
 * the same tile repeats across whole walls. Light falls from the upper left, so crater bowls are
 * shadowed along their top and lit along their bottom.
 */
import { Frame } from '../../../art/keys.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { SpaceTex, type SpaceTexKey } from '../keys.ts';
import { SpaceTerrainPalette } from '../palettes.ts';

/**
 * Asteroid rock facing open space: a sunlit rim along the top, then dull rock pocked with two small
 * craters, lit bumps and pits, kept small so a whole wall reads as rough rock rather than a grid. Drawn in the earth palette's three browns; its fourth colour (the forest's grass)
 * is left out.
 */
const ASTEROID_ROWS = [
  '2222222222122222',
  '1211122111111211',
  '1111111110111121',
  '1121111111111110',
  '1111221111112111',
  '1112001111111111',
  '1112011211121111',
  '1111122111111011',
  '1211111111111111',
  '1111111211111111',
  '1111111111120111',
  '1101111111201211',
  '1111121111122111',
  '1111111111111111',
  '0111111211111101',
  '1111111011121111',
];

/** Asteroid rock with more rock over it: the same craters with no sunlit rim, so deep rock doesn't stripe. */
const BURIED_ASTEROID_ROWS = ['1111111111101111', '1111211111111111', ...ASTEROID_ROWS.slice(2)];

/**
 * Ice: a pale block lit along its top and left, shadowed along its bottom and right so stacked blocks
 * read apart, with one crack running across it because it breaks. Its palette's moss is left out.
 */
const ICE_ROWS = [
  '2222222222222221',
  '2222222212222211',
  '2222222202222221',
  '2212222220222221',
  '2222222220222221',
  '2222222202222221',
  '2222200022222221',
  '2222022222222221',
  '2220222222212221',
  '2202222221222221',
  '2022222210222221',
  '2222222102222221',
  '2222221022222121',
  '2212222222222221',
  '2222222222222221',
  '1111111111111111',
];

/** A ledge tile: a three-pixel strut along the top of an otherwise empty tile, so racers can pass up through it. */
const STRUT_ROWS = [
  '2222222222222222',
  '1001100110011001',
  '0000000000000000',
  ...Array.from({ length: 13 }, () => '................'),
];

/** Ice chips: a few pale shards with dark edges. */
const ICE_CHIP_ROWS = ['..22....', '.2210...', '.110..2.', '..0..221', '.....10.', '2.......', '21..22..', '.0..10..'];

/** The finish gate: two pylons with a beacon at each, framing a checkered field. Repeats down the finish column. */
const GATE_ROWS = [
  '..032222111130..',
  '..002222111100..',
  '..002222111100..',
  '..002222111100..',
  '..001111222200..',
  '..001111222200..',
  '..001111222200..',
  '..001111222200..',
  '..032222111130..',
  '..002222111100..',
  '..002222111100..',
  '..002222111100..',
  '..001111222200..',
  '..001111222200..',
  '..001111222200..',
  '..001111222200..',
];

/** Terrain sheets. The tileset frames sit in `SpaceTile` order: rock, ice, the strut, then buried rock. */
export const TERRAIN_SHEETS: readonly ArtSheet<SpaceTexKey>[] = [
  {
    key: SpaceTex.tiles,
    frames: [
      { name: 'rock', palette: SpaceTerrainPalette.earth, rows: ASTEROID_ROWS },
      { name: 'coral', palette: SpaceTerrainPalette.crackedIce, rows: ICE_ROWS },
      { name: 'ledge', palette: SpaceTerrainPalette.branch, rows: STRUT_ROWS },
      { name: 'rockBuried', palette: SpaceTerrainPalette.earth, rows: BURIED_ASTEROID_ROWS },
    ],
  },
  sheet(SpaceTex.iceDebris, SpaceTerrainPalette.crackedIce, { [Frame.a]: ICE_CHIP_ROWS }),
  sheet(SpaceTex.finishGate, SpaceTerrainPalette.finish, { [Frame.a]: GATE_ROWS }),
];
