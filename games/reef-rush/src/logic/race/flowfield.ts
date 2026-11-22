/**
 * Distance-to-finish fields over the tile grid (see FlowFields): the cost model,
 * building and rebuilding the fields, and reading them (how far along a body is,
 * which starts can't reach the finish). Steering on a field lives in `ai/steer.ts`.
 *
 * Every field is a Dijkstra search outward from the finish column over 8
 * neighbours. Fields differ only in what it costs to enter a tile, so each one
 * is an EntryCost run through the same search.
 */
import { cellAt, tileIndex } from '../level/query.ts';
import { length } from '../num.ts';
import { type Body, type Cell, type FlowFields, type Level, TILE, type Vec } from '../types.ts';
import { PriorityQueue } from './priority-queue.ts';

/** Cost multiplier for swimming into a tile along `move` (-1, 0 or 1 per axis); Infinity means closed. */
type EntryCost = (cell: Cell, isBroken: boolean, move: Vec) => number;

/** A tile waiting in the Dijkstra frontier with the cost it was reached at. */
type QueuedTile = { cost: number; tx: number; ty: number };

const KELP_COST = 2.5;
const WITH_CURRENT_COST = 0.4;
const AGAINST_CURRENT_COST = 3;
const SMASH_CORAL_COST = 6;
const STILL: Vec = { x: 0, y: 0 };

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

const CURRENT_DIRECTION: Partial<Record<Cell, Vec>> = {
  'current-right': { x: 1, y: 0 },
  'current-left': { x: -1, y: 0 },
  'current-up': { x: 0, y: -1 },
  'current-down': { x: 0, y: 1 },
};

/** Uniform cost with only rock closed, so places don't depend on terrain or broken coral. */
const progressCost: EntryCost = (cell) => (cell === 'rock' ? Number.POSITIVE_INFINITY : 1);

/** What a swimmer feels: kelp drags, currents help or hinder, unbroken coral is a wall. */
const steerCost: EntryCost = (cell, isBroken, move) => {
  if (cell === 'rock') return Number.POSITIVE_INFINITY;
  if (cell === 'coral') return isBroken ? 1 : Number.POSITIVE_INFINITY;
  if (cell === 'kelp') return KELP_COST;
  const current = CURRENT_DIRECTION[cell];
  return current ? currentCost(current, move) : 1;
};

/** Like steer, but a racer able to break coral may plough through it at a price. */
const smashCost: EntryCost = (cell, isBroken, move) =>
  cell === 'coral' && !isBroken ? SMASH_CORAL_COST : steerCost(cell, isBroken, move);

/**
 * A diagonal entry counts as with or against the current by the sign of its component along
 * the current, the same as a straight one; only a move with no component along it is across.
 */
function currentCost(current: Vec, move: Vec): number {
  const along = current.x * move.x + current.y * move.y;
  if (along > 0) return WITH_CURRENT_COST;
  if (along < 0) return AGAINST_CURRENT_COST;
  return 1;
}

/**
 * The corner rule shared by every walk over the grid: a diagonal step from `tile` by `offset` is
 * allowed only when both tiles beside it are open. Orthogonal steps always pass.
 */
export function cornerIsClear(tile: Vec, offset: Vec, isOpen: (tx: number, ty: number) => boolean): boolean {
  if (offset.x === 0 || offset.y === 0) return true;
  return isOpen(tile.x + offset.x, tile.y) && isOpen(tile.x, tile.y + offset.y);
}

/** Builds all three fields by Dijkstra from the finish column. */
export function buildFlowFields(level: Level, broken: ReadonlySet<number>): FlowFields {
  return {
    width: level.width,
    height: level.height,
    progress: distancesToFinish(level, broken, progressCost),
    steer: distancesToFinish(level, broken, steerCost),
    smash: distancesToFinish(level, broken, smashCost),
  };
}

/**
 * The fields after coral breaks: steer and smash rebuilt for `broken`, progress shared as is,
 * since it treats coral as passable whether broken or not.
 */
export function rebuildForBrokenCoral(fields: FlowFields, level: Level, broken: ReadonlySet<number>): FlowFields {
  return {
    ...fields,
    steer: distancesToFinish(level, broken, steerCost),
    smash: distancesToFinish(level, broken, smashCost),
  };
}

/** Cheapest cost from every tile to any finish tile, in tiles; Infinity where the finish is out of reach. */
function distancesToFinish(level: Level, broken: ReadonlySet<number>, cost: EntryCost): Float32Array {
  const entry = (tx: number, ty: number, move: Vec) =>
    cost(cellAt(level, tx, ty), broken.has(tileIndex(level, tx, ty)), move);
  const isOpen = (tx: number, ty: number) => Number.isFinite(entry(tx, ty, STILL));
  // Searched in float64 so sums don't drift; stored as float32 per the FlowFields contract.
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
      // The search runs backwards: a swimmer on the neighbour moves into this tile.
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
 * Value of a field at a tile using the FlowFields `y * width + x` layout.
 *
 * @returns Infinity outside the grid, the same as an unreachable tile.
 */
export function fieldAt(field: Float32Array, fields: FlowFields, tile: Vec): number {
  if (tile.x < 0 || tile.y < 0 || tile.x >= fields.width || tile.y >= fields.height) return Number.POSITIVE_INFINITY;
  return field[tile.y * fields.width + tile.x] ?? Number.POSITIVE_INFINITY;
}

/**
 * Distance to the finish in tiles at a body's centre, sampled bilinearly between the four tile
 * centres around it. The reading is continuous as the body moves, including through turns, so
 * places don't flicker when two racers round a corner side by side.
 *
 * @returns Infinity only when all four surrounding tiles are unreachable.
 */
export function progressAt(fields: FlowFields, body: Body): number {
  // Field values sit at tile centres, so the 2x2 block starts half a tile up and left of the body.
  const gridX = (body.x + body.w / 2) / TILE - 0.5;
  const gridY = (body.y + body.h / 2) / TILE - 0.5;
  const left = Math.floor(gridX);
  const top = Math.floor(gridY);
  const corners = filledCorners(fields, left, top);
  if (!corners) return Number.POSITIVE_INFINITY;
  const [topLeft, topRight, bottomLeft, bottomRight] = corners;
  const fx = gridX - left;
  const fy = gridY - top;
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
function filledCorners(fields: FlowFields, left: number, top: number): [number, number, number, number] | null {
  const raw = [
    fieldAt(fields.progress, fields, { x: left, y: top }),
    fieldAt(fields.progress, fields, { x: left + 1, y: top }),
    fieldAt(fields.progress, fields, { x: left, y: top + 1 }),
    fieldAt(fields.progress, fields, { x: left + 1, y: top + 1 }),
  ];
  // Index bits are (row, column): i ^ 1 is the same row, i ^ 2 the same column, i ^ 3 opposite.
  const filled = raw.map((_, i) => [i, i ^ 1, i ^ 2, i ^ 3].map((j) => raw[j] ?? Number.NaN).find(Number.isFinite));
  const [topLeft, topRight, bottomLeft, bottomRight] = filled;
  if (topLeft === undefined || topRight === undefined || bottomLeft === undefined || bottomRight === undefined) {
    return null;
  }
  return [topLeft, topRight, bottomLeft, bottomRight];
}

/** Indices into `level.starts` whose tile cannot reach the finish on the `steer` field. */
export function unreachableStarts(level: Level, fields: FlowFields): number[] {
  return level.starts.flatMap((start, index) => (Number.isFinite(fieldAt(fields.steer, fields, start)) ? [] : [index]));
}
