/**
 * The flowing cells: a fog bank and the four winds (gust streaks left and right, rising and falling
 * wisps). Each is two frames drawn over open cells and under the racers, so racers always show in
 * front of them. The fog is a quarter-density haze with a few brighter wisps, so a fog bank reads as
 * a soft band the backdrop shows through rather than a wall. Every sprite is 16x16 and seamless in
 * both axes; frame `b` is frame `a` moved along the flow, and the left wind and the downdraft are the
 * mirror images of right and up.
 */
import { Frame } from '../../../art/keys.ts';
import type { PixelRows } from '../../../art/pixel.ts';
import { flipRows, mirrorRows, shiftRows } from '../../../art/rows.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { SkyThemeTex, type SkyThemeTexKey } from '../keys.ts';
import { SkyTerrainPalette } from '../palettes.ts';

/** Fog: haze dithered over a quarter of the cell, crossed by a few brighter wisps. */
const FOG_ROWS = [
  '0...0...0...0...',
  '..0...0...0...0.',
  '0...0111110.0...',
  '..0...0...0...0.',
  '0...0...0...0...',
  '..0...0...0...0.',
  '111110..0...0111',
  '..0...0...0...0.',
  '0...0...0...0...',
  '..0...0...0...0.',
  '0...0...011111..',
  '..0...0...0...0.',
  '0...0...0...0...',
  '..0111110...0...',
  '0...0...0...0...',
  '..0...0...0...0.',
];

/**
 * Wind blowing right: four long faint streaks that end in a bright head, sparse enough that a wide
 * gust band reads as moving air over the backdrop rather than a texture filling the frame.
 */
const GUST_ROWS = [
  '................',
  '...0000011......',
  '................',
  '................',
  '................',
  '0011.......00000',
  '................',
  '................',
  '................',
  '.........0000011',
  '................',
  '................',
  '................',
  '.....000011.....',
  '................',
  '................',
];

/** An updraft: bright wisps curling up, each a small chevron with a faint tail below it. */
const UPDRAFT_ROWS = [
  '................',
  '...1............',
  '..0.0.......1...',
  '...0.......0.0..',
  '...0........0...',
  '............0...',
  '.......1........',
  '......0.0.......',
  '.......0........',
  '.......0........',
  '..............1.',
  '.1...........0.0',
  '0.0...........0.',
  '.0..............',
  '.0..............',
  '................',
];

/** Pixels a gust moves between its frames. */
const GUST_STEP = 6;
/** Pixels a rising or falling wisp moves between its frames. */
const DRAFT_STEP = 4;
/** Pixels the fog drifts sideways between its frames. */
const FOG_STEP = 2;

/** Frames `a` and `b` for a flow: `rows`, then the same drawing moved one step. */
function flowFrames(rows: PixelRows, dx: number, dy: number): Record<string, PixelRows> {
  return { [Frame.a]: rows, [Frame.b]: shiftRows(rows, dx, dy) };
}

/** Flowing-cell sheets. */
export const FLOW_SHEETS: readonly ArtSheet<SkyThemeTexKey>[] = [
  sheet(SkyThemeTex.fog, SkyTerrainPalette.fog, flowFrames(FOG_ROWS, FOG_STEP, 0)),
  sheet(SkyThemeTex.windRight, SkyTerrainPalette.wind, flowFrames(GUST_ROWS, GUST_STEP, 0)),
  sheet(SkyThemeTex.windLeft, SkyTerrainPalette.wind, {
    [Frame.a]: mirrorRows(GUST_ROWS),
    [Frame.b]: mirrorRows(shiftRows(GUST_ROWS, GUST_STEP, 0)),
  }),
  sheet(SkyThemeTex.updraft, SkyTerrainPalette.wind, flowFrames(UPDRAFT_ROWS, 0, -DRAFT_STEP)),
  sheet(SkyThemeTex.downdraft, SkyTerrainPalette.wind, {
    [Frame.a]: flipRows(UPDRAFT_ROWS),
    [Frame.b]: flipRows(shiftRows(UPDRAFT_ROWS, 0, -DRAFT_STEP)),
  }),
];
