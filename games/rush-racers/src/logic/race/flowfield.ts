/**
 * Distance-to-finish fields over the tile grid: the Dijkstra search every field is built with, the
 * generic progress field that ranks racers, and reading fields (a tile's value, how far along a body
 * is). Fields differ only in what it costs to enter a tile, so each one is an EntryCost run through
 * the same search over 8 neighbours from the finish column. Media price tiles their own way
 * (`Medium.enterCost`), with `alongCost` for currents and winds; the progress field's cost is
 * uniform and medium-free. `unreachableStarts` is the level check every open-field medium runs.
 */
import { cellAt, isRockLike, tileIndex } from '../level/query.ts';
import { length } from '../num.ts';
import { type Box, type Cell, type GridSize, type Level, type ProgressField, TILE, type Vec } from '../types.ts';
import { PriorityQueue } from './priority-queue.ts';

/**
 * Cost multiplier for moving into a tile along `move` (-1, 0 or 1 per axis); Infinity means closed.
 * `tile` is where the tile is, for a medium whose price depends on it (flight keeps flyers off the
 * bottom rows over open sky); most costs ignore it and take fewer parameters.
 */
export type EntryCost = (cell: Cell, isBroken: boolean, move: Vec, tile: Vec) => number;

/** A tile waiting in the Dijkstra frontier with the cost it was reached at. */
type QueuedTile = { cost: number; tx: number; ty: number };

const STILL: Vec = { x: 0, y: 0 };
const NOTHING_BROKEN: ReadonlySet<number> = new Set();

/**
 * The 8 neighbour offsets, orthogonal first. Every walk over the grid visits them in this order,
 * so ties resolve the same way every run.
 */
export const NEIGHBOURS: readonly Vec[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

/** Uniform cost with only rock (and bounce clouds, rock-like) closed, so places don't depend on terrain or broken coral. */
const progressCost: EntryCost = (cell) => (isRockLike(cell) ? Number.POSITIVE_INFINITY : 1);

/**
 * The corner rule shared by every walk over the grid: a diagonal step from `tile` by `offset` is
 * allowed only when both tiles beside it are open. Orthogonal steps always pass.
 */
export function cornerIsClear(tile: Vec, offset: Vec, isOpen: (tx: number, ty: number) => boolean): boolean {
  if (offset.x === 0 || offset.y === 0) return true;
  return isOpen(tile.x + offset.x, tile.y) && isOpen(tile.x, tile.y + offset.y);
}

/**
 * The progress field for `level`. Coral counts as open whether broken or not, so the field never
 * needs rebuilding during a race.
 */
export function buildProgressField(level: Level): ProgressField {
  return {
    width: level.width,
    height: level.height,
    distance: distancesToFinish(level, NOTHING_BROKEN, progressCost),
  };
}

/** Cheapest cost from every tile to any finish tile, in tiles; Infinity where the finish is out of reach. */
export function distancesToFinish(level: Level, broken: ReadonlySet<number>, cost: EntryCost): Float32Array {
  const entry = (tx: number, ty: number, move: Vec) =>
    cost(cellAt(level, tx, ty), broken.has(tileIndex(level, tx, ty)), move, { x: tx, y: ty });
  const isOpen = (tx: number, ty: number) => Number.isFinite(entry(tx, ty, STILL));
  // Searched in float64 so sums don't drift; stored as float32 like every field.
  const distance = new Float64Array(level.width * level.height).fill(Number.POSITIVE_INFINITY);
  const frontier = new PriorityQueue<QueuedTile>();
  for (let ty = 0; ty < level.height; ty++) {
    if (!isOpen(level.finishX, ty)) continue;
    distance[tileIndex(level, level.finishX, ty)] = 0;
    frontier.push(0, { cost: 0, tx: level.finishX, ty });
  }

  for (let next = frontier.pop(); next; next = frontier.pop()) {
    const { cost: settled, tx, ty } = next;
    if (settled > (distance[tileIndex(level, tx, ty)] ?? 0)) continue;
    for (const offset of NEIGHBOURS) {
      // The search runs backwards: a racer on the neighbour moves into this tile.
      const fromX = tx + offset.x;
      const fromY = ty + offset.y;
      if (!isOpen(fromX, fromY)) continue;
      if (!cornerIsClear({ x: tx, y: ty }, offset, isOpen)) continue;
      const move = { x: -offset.x, y: -offset.y };
      const reached = settled + length(move.x, move.y) * entry(tx, ty, move);
      const fromIndex = tileIndex(level, fromX, fromY);
      if (reached >= (distance[fromIndex] ?? 0)) continue;
      distance[fromIndex] = reached;
      frontier.push(reached, { cost: reached, tx: fromX, ty: fromY });
    }
  }
  return Float32Array.from(distance);
}

/**
 * Value of a field laid out `y * width + x` over a grid of `size`, at a tile.
 *
 * @returns Infinity outside the grid, the same as an unreachable tile.
 */
export function fieldAt(field: Float32Array, size: GridSize, tile: Vec): number {
  if (tile.x < 0 || tile.y < 0 || tile.x >= size.width || tile.y >= size.height) return Number.POSITIVE_INFINITY;
  return field[tile.y * size.width + tile.x] ?? Number.POSITIVE_INFINITY;
}

/** What it costs to enter a flow cell (a current or a wind), as a multiplier on a plain step. */
export interface FlowPrices {
  /** A move with a positive component along the flow. */
  withFlow: number;
  /** A move with a negative component along the flow. */
  againstFlow: number;
}

/**
 * The price of entering a cell that flows along `flow` by `move`. A diagonal entry counts as with
 * or against the flow by the sign of its component along it, the same as a straight one; only a
 * move with no component along it is across, and costs 1 like open water or sky.
 */
export function alongCost(flow: Vec, move: Vec, prices: FlowPrices): number {
  const along = flow.x * move.x + flow.y * move.y;
  if (along > 0) return prices.withFlow;
  if (along < 0) return prices.againstFlow;
  return 1;
}

/** A start tile that can't reach the finish, as `Medium.validateLevel` reports it. */
export interface UnreachableStart {
  message: string;
  row: number;
  col: number;
}

/**
 * One problem for each of `level`'s starts whose tile is Infinity on `field`, located at that start.
 * Each message reads `Start <n> <reason>`, numbering starts from 1.
 */
export function unreachableStarts(
  level: Level,
  field: Float32Array,
  size: GridSize,
  reason: string,
): UnreachableStart[] {
  return level.starts.flatMap((start, index) =>
    Number.isFinite(fieldAt(field, size, start))
      ? []
      : [{ message: `Start ${index + 1} ${reason}`, row: start.y, col: start.x }],
  );
}

/**
 * Distance to the finish in tiles at a body's centre, sampled bilinearly between the four tile
 * centres around it. The reading is continuous as the body moves, including through turns, so
 * places don't flicker when two racers round a corner side by side.
 *
 * A body whose centre is below the last row's centre (falling out through a pit) reads the last
 * row, so a fall never turns into Infinity and reorders places.
 *
 * @returns Infinity only when all four surrounding tiles are unreachable.
 */
export function progressAt(progress: ProgressField, body: Box): number {
  // Field values sit at tile centres, so the 2x2 block starts half a tile up and left of the body.
  const gridX = (body.x + body.w / 2) / TILE - 0.5;
  const gridY = Math.min((body.y + body.h / 2) / TILE - 0.5, progress.height - 1);
  const left = Math.floor(gridX);
  const upperRow = Math.floor(gridY);
  const corners = filledCorners(progress, left, upperRow);
  if (!corners) return Number.POSITIVE_INFINITY;
  const [topLeft, topRight, bottomLeft, bottomRight] = corners;
  const fx = gridX - left;
  const fy = gridY - upperRow;
  const upper = topLeft + (topRight - topLeft) * fx;
  const lower = bottomLeft + (bottomRight - bottomLeft) * fx;
  return upper + (lower - upper) * fy;
}

/**
 * Progress at tile (left, top) and its right, lower and lower-right neighbours, in that order.
 * An unreachable corner (rock, off the grid) takes the value beside it in the same row, else the
 * same column, else the opposite corner. The choice depends only on the 2x2 block, so readings
 * stay continuous, and a wall flattens the field toward it instead of pulling it to Infinity.
 *
 * @returns null when no corner is reachable.
 */
function filledCorners(progress: ProgressField, left: number, top: number): [number, number, number, number] | null {
  const raw = [
    fieldAt(progress.distance, progress, { x: left, y: top }),
    fieldAt(progress.distance, progress, { x: left + 1, y: top }),
    fieldAt(progress.distance, progress, { x: left, y: top + 1 }),
    fieldAt(progress.distance, progress, { x: left + 1, y: top + 1 }),
  ];
  // Index bits are (row, column): i ^ 1 is the same row, i ^ 2 the same column, i ^ 3 opposite.
  const filled = raw.map((_, i) => [i, i ^ 1, i ^ 2, i ^ 3].map((j) => raw[j] ?? Number.NaN).find(Number.isFinite));
  const [topLeft, topRight, bottomLeft, bottomRight] = filled;
  if (topLeft === undefined || topRight === undefined || bottomLeft === undefined || bottomRight === undefined) {
    return null;
  }
  return [topLeft, topRight, bottomLeft, bottomRight];
}
