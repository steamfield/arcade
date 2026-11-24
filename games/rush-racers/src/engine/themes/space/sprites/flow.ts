/**
 * The flowing cells: nebula dust and the four solar winds. Each is two frames drawn over open cells,
 * so they are sparse and the racer stays visible through them. Every sprite is 16x16 and seamless in
 * both axes. Dust sways sideways between its frames, since nothing in space settles or rises. A wind's
 * frame `b` is frame `a` moved along the wind; left is the mirror of right, down is right turned on
 * its diagonal, and up is down flipped.
 */
import { Frame } from '../../../art/keys.ts';
import type { PixelRows } from '../../../art/pixel.ts';
import { flipRows, mirrorRows, shiftRows, transposeRows } from '../../../art/rows.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { SpaceTex, type SpaceTexKey } from '../keys.ts';
import { SpaceTerrainPalette } from '../palettes.ts';

/**
 * Nebula dust: dithered wisps of the dust body colour with a few glinting grains, more gap than cloud
 * so a racer inside it still reads.
 */
const NEBULA_ROWS = [
  '................',
  '..1.1...........',
  '.1.1.1.......2..',
  '..1.1.1.1.......',
  '.....1.1.1......',
  '..............1.',
  '.2...........1.1',
  '............1.1.',
  '.......1.....1..',
  '......1.1.1.....',
  '.....1.1.1.1....',
  '......1.1.1...2.',
  '...........1....',
  '1.1.............',
  '.1.1......2.....',
  '1.1.1...........',
];

/** Solar wind blowing right: dotted trails of particles that thicken into a bright head. */
const SOLAR_WIND_ROWS = [
  '................',
  '..0.0.0011......',
  '................',
  '................',
  '1.........0.0.00',
  '................',
  '................',
  '....0.00011.....',
  '................',
  '................',
  '.........0.0.001',
  '................',
  '................',
  '0011.......0.0.0',
  '................',
  '................',
];

/** Wind blowing down: the rightward trails turned so their heads lead downward. */
const SOLAR_WIND_DOWN_ROWS = transposeRows(SOLAR_WIND_ROWS);

/** Sideways sway of the dust between frames: two pixels, so its checkered dither keeps its phase. */
const DUST_SWAY = 2;
/** How far a wind's particles move between frames. */
const WIND_STEP = 4;

/** Frames `a` and `b` for a flow: `rows`, then the same drawing moved one step. */
function flowFrames(rows: PixelRows, dx: number, dy: number): Record<string, PixelRows> {
  return { [Frame.a]: rows, [Frame.b]: shiftRows(rows, dx, dy) };
}

/** Flowing-cell sheets. */
export const FLOW_SHEETS: readonly ArtSheet<SpaceTexKey>[] = [
  sheet(SpaceTex.dust, SpaceTerrainPalette.dust, flowFrames(NEBULA_ROWS, DUST_SWAY, 0)),
  sheet(SpaceTex.windRight, SpaceTerrainPalette.wind, flowFrames(SOLAR_WIND_ROWS, WIND_STEP, 0)),
  sheet(SpaceTex.windLeft, SpaceTerrainPalette.wind, {
    [Frame.a]: mirrorRows(SOLAR_WIND_ROWS),
    [Frame.b]: mirrorRows(shiftRows(SOLAR_WIND_ROWS, WIND_STEP, 0)),
  }),
  sheet(SpaceTex.windDown, SpaceTerrainPalette.wind, flowFrames(SOLAR_WIND_DOWN_ROWS, 0, WIND_STEP)),
  sheet(SpaceTex.windUp, SpaceTerrainPalette.wind, {
    [Frame.a]: flipRows(SOLAR_WIND_DOWN_ROWS),
    [Frame.b]: flipRows(shiftRows(SOLAR_WIND_DOWN_ROWS, 0, WIND_STEP)),
  }),
];
