/**
 * Distance-to-finish fields over the tile grid (see FlowFields) and the two
 * questions asked of them: how far along is a body, and which way should it swim.
 *
 * Every field is a Dijkstra search outward from the finish column over 8
 * neighbours. Fields differ only in what it costs to enter a tile, so each one
 * is an EntryCost run through the same search.
 */
import { cellAt, isSolid, tileIndex } from '../level/query.ts';
import { type Body, type Cell, type FlowFields, type Level, TILE, type Vec } from '../types.ts';

/**
 * Cost multiplier for swimming into a tile along `move` (-1, 0 or 1 on each axis).
 * Infinity means the tile can't be entered at all.
 */
type EntryCost = (cell: Cell, isBroken: boolean, move: Vec) => number;

interface QueuedTile {
  cost: number;
  tx: number;
  ty: number;
}

const KELP_COST = 2.5;
const WITH_CURRENT_COST = 0.4;
const AGAINST_CURRENT_COST = 3;
const SMASH_CORAL_COST = 6;
/** Pixels between samples when checking that a straight line stays in open water. */
const SIGHT_STEP_PX = 1;
const STILL: Vec = { x: 0, y: 0 };

/** The 8 neighbour offsets, orthogonal first, in a fixed order so ties resolve the same way every run. */
const NEIGHBOURS: readonly Vec[] = [
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

/** Builds all three fields by Dijkstra from the finish column. Rebuild when coral breaks. */
export function buildFlowFields(level: Level, broken: ReadonlySet<number>): FlowFields {
  return {
    width: level.width,
    height: level.height,
    progress: distancesToFinish(level, broken, progressCost),
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
  const frontier = new MinQueue();
  for (let ty = 0; ty < level.height; ty++) {
    if (!isOpen(level.finishX, ty)) continue;
    distance[tileIndex(level, level.finishX, ty)] = 0;
    frontier.push({ cost: 0, tx: level.finishX, ty });
  }

  for (let next = frontier.pop(); next; next = frontier.pop()) {
    const { cost: settled, tx, ty } = next;
    if (settled > (distance[tileIndex(level, tx, ty)] ?? 0)) continue;
    for (const offset of NEIGHBOURS) {
      // The search runs backwards: a swimmer on the neighbour moves into this tile.
      const fromX = tx + offset.x;
      const fromY = ty + offset.y;
      if (!isOpen(fromX, fromY)) continue;
      if (offset.x !== 0 && offset.y !== 0 && !(isOpen(tx, fromY) && isOpen(fromX, ty))) continue;
      const move = { x: -offset.x, y: -offset.y };
      const reached = settled + Math.hypot(move.x, move.y) * entry(tx, ty, move);
      const fromIndex = tileIndex(level, fromX, fromY);
      if (reached >= (distance[fromIndex] ?? 0)) continue;
      distance[fromIndex] = reached;
      frontier.push({ cost: reached, tx: fromX, ty: fromY });
    }
  }
  return Float32Array.from(distance);
}

/** A binary min-heap of tiles keyed by cost, just enough for Dijkstra. */
class MinQueue {
  private readonly items: QueuedTile[] = [];

  push(tile: QueuedTile): void {
    this.items.push(tile);
    let i = this.items.length - 1;
    while (i > 0 && this.isLower(i, (i - 1) >> 1)) {
      this.swap(i, (i - 1) >> 1);
      i = (i - 1) >> 1;
    }
  }

  pop(): QueuedTile | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length === 0 || !last) return top;
    this.items[0] = last;
    let i = 0;
    for (;;) {
      let lowest = i;
      for (const child of [2 * i + 1, 2 * i + 2]) if (this.isLower(child, lowest)) lowest = child;
      if (lowest === i) return top;
      this.swap(i, lowest);
      i = lowest;
    }
  }

  private isLower(i: number, j: number): boolean {
    const a = this.items[i];
    const b = this.items[j];
    return a !== undefined && b !== undefined && a.cost < b.cost;
  }

  private swap(i: number, j: number): void {
    const held = this.items[i] as QueuedTile;
    this.items[i] = this.items[j] as QueuedTile;
    this.items[j] = held;
  }
}

/** Value of a field at a tile using the FlowFields `y * width + x` layout; Infinity outside the grid. */
function fieldAt(field: Float32Array, fields: FlowFields, tile: Vec): number {
  if (tile.x < 0 || tile.y < 0 || tile.x >= fields.width || tile.y >= fields.height) return Number.POSITIVE_INFINITY;
  return field[tile.y * fields.width + tile.x] ?? Number.POSITIVE_INFINITY;
}

function centreOf(body: Body): Vec {
  return { x: body.x + body.w / 2, y: body.y + body.h / 2 };
}

function tileOf(point: Vec): Vec {
  return { x: Math.floor(point.x / TILE), y: Math.floor(point.y / TILE) };
}

function tileCentre(tile: Vec): Vec {
  return { x: (tile.x + 0.5) * TILE, y: (tile.y + 0.5) * TILE };
}

/**
 * Distance to the finish in tiles at a body's centre, interpolated inside the tile toward its
 * lowest neighbour so a body further along the same tile reads lower.
 *
 * @returns Infinity when the centre's tile can't reach the finish.
 */
export function progressAt(fields: FlowFields, _level: Level, body: Body): number {
  const centre = centreOf(body);
  const tile = tileOf(centre);
  const here = fieldAt(fields.progress, fields, tile);
  const lowest = lowestNeighbour(fields, tile);
  if (!lowest || !Number.isFinite(here)) return here;

  // Fraction of the way from this tile's centre to the neighbour's, within -0.5..0.5, so the
  // value is continuous as the centre crosses into the next tile.
  const centreTile = tileCentre(tile);
  const offset = lowest.offset;
  const along = ((centre.x - centreTile.x) * offset.x + (centre.y - centreTile.y) * offset.y) / TILE;
  return here + (along / (offset.x ** 2 + offset.y ** 2)) * (lowest.value - here);
}

/** The first of the 8 neighbours with the lowest progress strictly below the tile's own, or null. */
function lowestNeighbour(fields: FlowFields, tile: Vec): { offset: Vec; value: number } | null {
  let lowest: { offset: Vec; value: number } | null = null;
  let lowestValue = fieldAt(fields.progress, fields, tile);
  for (const offset of NEIGHBOURS) {
    const value = fieldAt(fields.progress, fields, { x: tile.x + offset.x, y: tile.y + offset.y });
    if (value >= lowestValue) continue;
    lowest = { offset, value };
    lowestValue = value;
  }
  return lowest;
}

/**
 * Unit direction from a body's centre toward the tile `lookahead` steps down `field`,
 * never across a solid corner. `{x: 0, y: 0}` on a finish tile.
 *
 * @param lookahead Downhill steps to look ahead, in tiles; 3 is the usual value.
 */
export function steerDirection(
  field: Float32Array,
  fields: FlowFields,
  level: Level,
  broken: ReadonlySet<number>,
  body: Body,
  lookahead: number,
): Vec {
  const centre = centreOf(body);
  const start = tileOf(centre);
  if (fieldAt(field, fields, start) === 0) return { ...STILL };

  const path = downhillPath(field, fields, level, broken, start, lookahead);
  // The first step is always taken; later ones only while the straight line to them stays clear,
  // so the aim never cuts a corner the path itself goes around.
  let target = path[0];
  for (const tile of path.slice(1)) {
    if (!hasClearLine(level, broken, centre, tileCentre(tile))) break;
    target = tile;
  }
  if (!target) return { ...STILL };
  const aim = tileCentre(target);
  const length = Math.hypot(aim.x - centre.x, aim.y - centre.y);
  if (length === 0) return { ...STILL };
  return { x: (aim.x - centre.x) / length, y: (aim.y - centre.y) / length };
}

/** Up to `steps` tiles, each the lowest open neighbour of the last, stopping where nothing is lower. */
function downhillPath(
  field: Float32Array,
  fields: FlowFields,
  level: Level,
  broken: ReadonlySet<number>,
  start: Vec,
  steps: number,
): Vec[] {
  const solid = (tx: number, ty: number) => isSolid(level, broken, tx, ty);
  const path: Vec[] = [];
  let tile = start;
  for (let step = 0; step < steps; step++) {
    let next: Vec | null = null;
    let nextValue = fieldAt(field, fields, tile);
    for (const offset of NEIGHBOURS) {
      const candidate = { x: tile.x + offset.x, y: tile.y + offset.y };
      const value = fieldAt(field, fields, candidate);
      if (value >= nextValue || solid(candidate.x, candidate.y)) continue;
      if (offset.x !== 0 && offset.y !== 0 && (solid(candidate.x, tile.y) || solid(tile.x, candidate.y))) continue;
      next = candidate;
      nextValue = value;
    }
    if (!next) break;
    path.push(next);
    tile = next;
  }
  return path;
}

/** True when every point on the segment, sampled each SIGHT_STEP_PX, lies in a non-solid tile. */
function hasClearLine(level: Level, broken: ReadonlySet<number>, from: Vec, to: Vec): boolean {
  const samples = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / SIGHT_STEP_PX);
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const tile = tileOf({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
    if (isSolid(level, broken, tile.x, tile.y)) return false;
  }
  return true;
}

/** Indices into `level.starts` whose tile cannot reach the finish on the `steer` field. */
export function unreachableStarts(level: Level, fields: FlowFields): number[] {
  return level.starts.flatMap((start, index) => (Number.isFinite(fieldAt(fields.steer, fields, start)) ? [] : [index]));
}
