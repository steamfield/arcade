/**
 * The solid and decorative course tiles: the thunderhead, puff cloud, cloud ledge and bounce cloud
 * tileset, the puffs a popped cloud scatters and the finish banner. Thunderhead, ledge and bounce
 * tiles are 16x16 and seamless sideways, since the same tile repeats across whole walls; the
 * thunderhead's buried tile is seamless both ways. A puff cloud is a round lump with open corners, so
 * a column of them reads as soft, separate puffs a dash pops rather than a wall.
 */
import { Frame } from '../../../art/keys.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { SkyThemeTex, type SkyThemeTexKey } from '../keys.ts';
import { SkyTerrainPalette } from '../palettes.ts';

/**
 * Thunderhead inside the storm cloud: a flat, solid body crossed by one faint dithered streak that
 * runs edge to edge, with a few shadow flecks, so a wall reads as continuous horizontal cloud layers
 * rather than bricks or scales.
 */
const BURIED_THUNDERHEAD_ROWS = [
  '1111111111111111',
  '1111111111111111',
  '1111111111111111',
  '1212121212121212',
  '1112111211121112',
  '1111111111111111',
  '1111111111111111',
  '1111111111111011',
  '1111111111111111',
  '1111111111111111',
  '1111111111111111',
  '1101111111111111',
  '1111111111111111',
  '1111111111111111',
  '1111111110111111',
  '1111111111111111',
];

/** Thunderhead open above: a bright billowed top edge, then the buried body below it. */
const THUNDERHEAD_ROWS = [
  '2222333333332222',
  '1222233333322221',
  '1112222222222111',
  '1111111111111111',
  ...BURIED_THUNDERHEAD_ROWS.slice(4),
];

/** A puff cloud: a round off-white lump with a white crown and a cool shade underneath. */
const PUFF_CLOUD_ROWS = [
  '.....000000.....',
  '...0023333200...',
  '..022333333320..',
  '.02233333333220.',
  '.02233333332220.',
  '0222333333222220',
  '0222223332222220',
  '0222222222222220',
  '0122222222222210',
  '0112222222222110',
  '0111222222221110',
  '.01112222211110.',
  '.01111111111110.',
  '..011111111110..',
  '...0011111100...',
  '.....000000.....',
];

/** A ledge tile: a thin cloud wisp along the top of an otherwise empty tile, so racers can jump up through it. */
const CLOUD_LEDGE_ROWS = [
  '2233322223332222',
  '2222222222222222',
  '1112111111121111',
  '0000000000000000',
  ...Array.from({ length: 12 }, () => '................'),
];

/**
 * A bounce cloud: a coiled warm rim along its top, loops open to the sky like a spring seen side on,
 * over a pale warm body. Full width, so a run of them is one springy bed.
 */
const BOUNCE_CLOUD_ROWS = [
  '.33..33..33..33.',
  '3223322332233223',
  '2..22..22..22..2',
  '2222222222222222',
  '0000000000000000',
  '1111111111111111',
  '1111111111111111',
  '1101111111011111',
  '1111111111111111',
  '1111110111111101',
  '1111111111111111',
  '1011111110111111',
  '1111111111111111',
  '1111111111111111',
  '0111111001111110',
  '0000000000000000',
];

/** Sunbreak's illuminated cloud edge fades back into the thunderhead below. */
const SUNLIT_BANK_ROWS = [
  '2233333333322222',
  '2223333333333222',
  '2222222333322222',
  '1222222222222221',
  '1122222222222211',
  '1111122222211111',
  '1111111111111111',
  '1111111111111111',
  '0111111111111110',
  '0001111111110000',
  '0000011111100000',
  ...Array.from({ length: 5 }, () => '0000000000000000'),
];

/** Interlaced twigs and pale quills along the tops of the crows' perches. */
const CROW_ROOST_ROWS = [
  '2322212222223232',
  '2123322233322122',
  '3211122222111123',
  '2322211331122232',
  '1123322222332111',
  '1111132222311111',
  '2222222222222222',
  '1111111111111111',
  '1111111111111111',
  '1111100111111111',
  '1111111111111111',
  '1111111111111111',
  '1101111111100111',
  '1111111111111111',
  '1111111111111111',
  '1111111111111111',
];

/** Riveted cross-braces hold the cannon decks against the clouds. */
const CANNON_RIGGING_ROWS = [
  '2222222222222222',
  '2232222222222322',
  '0000000000000000',
  '2211000000112200',
  '1221100001122100',
  '1122110011221100',
  '0112211112211000',
  '0011221122110000',
  '0001123321100000',
  '0001123321100000',
  '0011221122110000',
  '0112211112211000',
  '1122110011221100',
  '1221100001122100',
  '2232222222222322',
  '2222222222222222',
];

/** One puff of a popped cloud: a small round tuft. */
const PUFF_DEBRIS_ROWS = [
  '..0000..',
  '.023320.',
  '02333220',
  '02222220',
  '01222210',
  '.011110.',
  '..0000..',
  '........',
];

/** The checkered finish banner, trimmed in gold cord down both sides so it hangs in open sky. */
const FINISH_ROWS = [
  ...Array.from({ length: 4 }, () => '...33222211113..'),
  ...Array.from({ length: 4 }, () => '...33111122223..'),
  ...Array.from({ length: 4 }, () => '...33222211113..'),
  ...Array.from({ length: 4 }, () => '...33111122223..'),
];

/** Terrain sheets. The tileset frames sit in `SkyThemeTile` order. */
export const TERRAIN_SHEETS: readonly ArtSheet<SkyThemeTexKey>[] = [
  {
    key: SkyThemeTex.tiles,
    frames: [
      { name: 'rock', palette: SkyTerrainPalette.thunderhead, rows: THUNDERHEAD_ROWS },
      { name: 'coral', palette: SkyTerrainPalette.puffCloud, rows: PUFF_CLOUD_ROWS },
      { name: 'ledge', palette: SkyTerrainPalette.puffCloud, rows: CLOUD_LEDGE_ROWS },
      { name: 'rockBuried', palette: SkyTerrainPalette.thunderhead, rows: BURIED_THUNDERHEAD_ROWS },
      { name: 'bounce', palette: SkyTerrainPalette.bounceCloud, rows: BOUNCE_CLOUD_ROWS },
      { name: 'sunlitBank', palette: SkyTerrainPalette.sunlitBank, rows: SUNLIT_BANK_ROWS },
      { name: 'crowRoost', palette: SkyTerrainPalette.crowRoost, rows: CROW_ROOST_ROWS },
      { name: 'cannonRigging', palette: SkyTerrainPalette.cannonRigging, rows: CANNON_RIGGING_ROWS },
    ],
  },
  sheet(SkyThemeTex.puffDebris, SkyTerrainPalette.puffCloud, { [Frame.a]: PUFF_DEBRIS_ROWS }),
  sheet(SkyThemeTex.finishGate, SkyTerrainPalette.finish, { [Frame.a]: FINISH_ROWS }),
];
