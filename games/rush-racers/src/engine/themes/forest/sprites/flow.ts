/**
 * The flowing cells: mud with slow bubbles and the four winds (gust streaks left and right, rising
 * and falling leaves). Each is two frames drawn over open cells, so they are sparse and the racer
 * stays visible through them. Every sprite is 16x16 and seamless in both axes; frame `b` is frame
 * `a` moved along the flow, and the left and down winds are the mirror images of right and up.
 */
import { Frame } from '../../../art/keys.ts';
import type { PixelRows } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { ForestTex, type ForestTexKey } from '../keys.ts';
import { ForestTerrainPalette } from '../palettes.ts';
import { flipRows, mirrorRows, shiftRows } from './rows.ts';

/** Mud: sparse dark blotches with a few wet-shine rings, which rise a row in the next frame. */
const MUD_ROWS = [
  '..1.....1.......',
  '.101...101..2...',
  '..1.....1..2.2..',
  '...........2....',
  '.....11.........',
  '....1001...1....',
  '.....11...101...',
  '...2..........1.',
  '..2.2....11.....',
  '...2....1001....',
  '.........11..2..',
  '.1...........2.2',
  '101.....2.....2.',
  '.1.....2.2......',
  '........2....11.',
  '..11.........101',
];

/** Wind blowing right: long faint streaks that end in a bright head. */
const GUST_ROWS = [
  '................',
  '..000001........',
  '................',
  '.........0000011',
  '................',
  '................',
  '...0000000011...',
  '................',
  '................',
  '.0000011........',
  '................',
  '.........000001.',
  '................',
  '................',
  '..00000011......',
  '................',
];

/** Leaves blown up: a lit leaf with a faint stem and trail below it. */
const LEAVES_UP_ROWS = [
  '................',
  '...11...........',
  '..110...........',
  '..0.............',
  '..0.............',
  '..........11....',
  '.........110....',
  '.........0......',
  '.........0......',
  '................',
  '.11.............',
  '110.............',
  '0...............',
  '0.........11....',
  '.........110....',
  '.........0......',
];

const GUST_STEP = 6;
const LEAF_STEP = 4;

/** Frames `a` and `b` for a flow: `rows`, then the same drawing moved one step. */
function flowFrames(rows: PixelRows, dx: number, dy: number): Record<string, PixelRows> {
  return { [Frame.a]: rows, [Frame.b]: shiftRows(rows, dx, dy) };
}

/** Flowing-cell sheets. */
export const FLOW_SHEETS: readonly ArtSheet<ForestTexKey>[] = [
  sheet(ForestTex.mud, ForestTerrainPalette.mud, flowFrames(MUD_ROWS, 0, -1)),
  sheet(ForestTex.windRight, ForestTerrainPalette.wind, flowFrames(GUST_ROWS, GUST_STEP, 0)),
  sheet(ForestTex.windLeft, ForestTerrainPalette.wind, {
    [Frame.a]: mirrorRows(GUST_ROWS),
    [Frame.b]: mirrorRows(shiftRows(GUST_ROWS, GUST_STEP, 0)),
  }),
  sheet(ForestTex.windUp, ForestTerrainPalette.wind, flowFrames(LEAVES_UP_ROWS, 0, -LEAF_STEP)),
  sheet(ForestTex.windDown, ForestTerrainPalette.wind, {
    [Frame.a]: flipRows(LEAVES_UP_ROWS),
    [Frame.b]: flipRows(shiftRows(LEAVES_UP_ROWS, 0, -LEAF_STEP)),
  }),
];
