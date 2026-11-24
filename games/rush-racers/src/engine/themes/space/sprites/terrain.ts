/**
 * The solid and decorative course tiles: the asteroid rock, breakable ice and strut tileset, the
 * chips a broken ice tile scatters and the finish gate. Tiles are 16x16. Rock and the strut are
 * seamless sideways, since the same tile repeats across whole walls; ice deliberately isn't, so each
 * block shows its own edges and a stack reads as separate blocks that break. Light falls from the
 * upper left.
 */
import { Frame } from '../../../art/keys.ts';
import { mirrorRows } from '../../../art/rows.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { SpaceTex, type SpaceTexKey } from '../keys.ts';
import { SpaceTerrainPalette } from '../palettes.ts';

/**
 * Asteroid rock facing open space: a sunlit rim along the top in the palette's brightest colour,
 * then dull rock pocked with small craters, lit bumps and pits, kept small so a whole wall reads as
 * rough rock rather than a grid.
 */
const ASTEROID_ROWS = [
  '3333333333233333',
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

/**
 * Asteroid rock with more rock over it: the same craters with no rim, so deep rock doesn't stripe,
 * and a sparse scatter of sunlit specks. A tile can't know which of its sides are open, so the
 * specks run to every edge and a ceiling or side wall shows where the speckled rock stops.
 */
const BURIED_ASTEROID_ROWS = [
  '1111111111101111',
  '1111211111111311',
  '1111111110111121',
  '3121111111111110',
  '1111221111112111',
  '1112001131111111',
  '1112011211121113',
  '1111122111111011',
  '1211111111111111',
  '1111311211111111',
  '1111111111120131',
  '1101111111201211',
  '3111121111122111',
  '1111111311111111',
  '0111111211111101',
  '1113111011121111',
];

/**
 * Ice: a pale block frosted along its top and left and shadowed along its bottom and right, so
 * stacked blocks read apart, with two cracks across it because it breaks.
 */
const ICE_ROWS = [
  '3333333333333331',
  '3222222212222211',
  '3222222202222221',
  '3212222220222221',
  '3222222220222221',
  '3222222202222221',
  '3222200022222221',
  '3222022222222221',
  '3220222222212221',
  '3202222221222221',
  '3022222210222221',
  '3222222102222221',
  '3222221022222121',
  '3212222222222221',
  '3222222222222221',
  '1111111111111111',
];

/** A ledge tile: a three-pixel strut along the top of an otherwise empty tile, so racers can pass up through it. */
const STRUT_ROWS = [
  '2222222222222222',
  '1001100110011001',
  '1111111111111111',
  ...Array.from({ length: 13 }, () => '................'),
];

/** Jet streams join at either side of the tile, with thinner filaments between the broad bands. */
const GAS_GIANT_ROWS = [
  '0000000000000000',
  '0000010000000000',
  '1111111111111111',
  '2222222222222222',
  '2222223333222222',
  '3333333333333333',
  '2222222222222222',
  '2221111111222222',
  '1111111111111111',
  '1111111111111111',
  '1122221111111111',
  '2222222222222222',
  '1111111111111111',
  '0000000000000000',
  '0000000111000000',
  '0000000000000000',
];

/** Ribbed plating marks the wall that shields the high road from the asteroid sweeps. */
const DEBRIS_SHIELD_ROWS = [
  '2222222222222222',
  '1111111111111110',
  '1011111111111010',
  '1111111111111110',
  '1113111311131110',
  '1131113111311110',
  '1311131113111110',
  '1111111111111110',
  '1111111111111110',
  '1111111111111110',
  '1111111111111110',
  '1011111111111010',
  '1111111111111110',
  '2222222222222222',
  '0000000000000000',
  '1111111111111111',
];

/** A three-tile arch shelters each ring. The crown and shoulders join the pillars at the seams. */
const EMPTY_ROW = '................';
const ARCH_CROWN_ROWS = [
  ...Array<string>(7).fill(EMPTY_ROW),
  '1111111111111111',
  '2222222222222222',
  '2223332222333222',
  '1112221111222111',
  '0000000000000000',
  ...Array<string>(4).fill(EMPTY_ROW),
];
const ARCH_SHOULDER_ROWS = [
  ...Array<string>(7).fill(EMPTY_ROW),
  '.............111',
  '...........11222',
  '..........122222',
  '.........1222111',
  '........12221000',
  '.......12210....',
  '.......1210.....',
  '......1210......',
  '......1210......',
];
const ARCH_PILLAR_ROWS = Array.from({ length: 16 }, (_, row) => (row === 3 ? '......1310......' : '......1210......'));

/** Ice chips: a few pale shards with dark edges. */
const ICE_CHIP_ROWS = ['..22....', '.2210...', '.110..2.', '..0..221', '.....10.', '2.......', '21..22..', '.0..10..'];

/**
 * The finish gate: two grey pylons framing a checkered field, each pylon with one beacon at the top
 * of the tile, so the beacons repeat every 16 px down the finish column.
 */
const GATE_ROWS = [
  '..032222111130..',
  '..002222111100..',
  '..002222111100..',
  '..002222111100..',
  '..001111222200..',
  '..001111222200..',
  '..001111222200..',
  '..001111222200..',
  '..002222111100..',
  '..002222111100..',
  '..002222111100..',
  '..002222111100..',
  '..001111222200..',
  '..001111222200..',
  '..001111222200..',
  '..001111222200..',
];

/** Terrain sheets, with tileset frames in `SpaceTile` order. */
export const TERRAIN_SHEETS: readonly ArtSheet<SpaceTexKey>[] = [
  {
    key: SpaceTex.tiles,
    frames: [
      { name: 'rock', palette: SpaceTerrainPalette.earth, rows: ASTEROID_ROWS },
      { name: 'coral', palette: SpaceTerrainPalette.crackedIce, rows: ICE_ROWS },
      { name: 'ledge', palette: SpaceTerrainPalette.branch, rows: STRUT_ROWS },
      { name: 'rockBuried', palette: SpaceTerrainPalette.earth, rows: BURIED_ASTEROID_ROWS },
      { name: 'gasGiant', palette: SpaceTerrainPalette.gasGiant, rows: GAS_GIANT_ROWS },
      { name: 'debrisShield', palette: SpaceTerrainPalette.debrisShield, rows: DEBRIS_SHIELD_ROWS },
      { name: 'archCrown', palette: SpaceTerrainPalette.wormwayArch, rows: ARCH_CROWN_ROWS },
      { name: 'archShoulderLeft', palette: SpaceTerrainPalette.wormwayArch, rows: ARCH_SHOULDER_ROWS },
      { name: 'archShoulderRight', palette: SpaceTerrainPalette.wormwayArch, rows: mirrorRows(ARCH_SHOULDER_ROWS) },
      { name: 'archPillarLeft', palette: SpaceTerrainPalette.wormwayArch, rows: ARCH_PILLAR_ROWS },
      { name: 'archPillarRight', palette: SpaceTerrainPalette.wormwayArch, rows: mirrorRows(ARCH_PILLAR_ROWS) },
    ],
  },
  sheet(SpaceTex.iceDebris, SpaceTerrainPalette.crackedIce, { [Frame.a]: ICE_CHIP_ROWS }),
  sheet(SpaceTex.finishGate, SpaceTerrainPalette.finish, { [Frame.a]: GATE_ROWS }),
];
