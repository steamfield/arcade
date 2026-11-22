/**
 * Which way a swimmer should head on a flow field: walk a few tiles downhill
 * from the body's tile, then aim at the furthest of them the whole body can
 * slide to in a straight line without clipping a solid tile. On the smash field
 * the walk may step into unbroken coral, so a racer able to break it aims at it.
 */
import { cellAt, isSolid } from '../level/query.ts';
import { length } from '../num.ts';
import { cornerIsClear, fieldAt, NEIGHBOURS } from '../race/flowfield.ts';
import { type Body, type FlowFields, type Level, TILE, type Vec } from '../types.ts';

/** Pixels between samples when checking that a straight slide stays in open water. */
const SIGHT_STEP_PX = 1;
/** Shrinks the swept box so an edge lying exactly on a tile boundary doesn't count as touching the next tile. */
const EDGE_INSET_PX = 0.001;
const STILL: Vec = { x: 0, y: 0 };
/** Unit signs of a box's four corners from its centre. */
const CORNER_SIGNS = NEIGHBOURS.filter((offset) => offset.x !== 0 && offset.y !== 0);

const centreOf = (body: Body): Vec => ({ x: body.x + body.w / 2, y: body.y + body.h / 2 });
/** The tile holding a point in world px. */
export const tileOf = (point: Vec): Vec => ({ x: Math.floor(point.x / TILE), y: Math.floor(point.y / TILE) });
const tileCentre = (tile: Vec): Vec => ({ x: (tile.x + 0.5) * TILE, y: (tile.y + 0.5) * TILE });

/**
 * Unit direction from a body's centre toward the tile `lookahead` steps down `field`,
 * never across a solid corner. `{x: 0, y: 0}` on a finish tile.
 *
 * @param field One of `fields`' arrays: `steer` for most racers, `smash` for one that can break coral.
 * @param lookahead Downhill steps to look ahead, in tiles; 3 is the usual value.
 * @param throughCoral Lets the downhill walk enter unbroken coral; pass true with the `smash` field.
 */
export function steerDirection(
  field: Float32Array,
  fields: FlowFields,
  level: Level,
  broken: ReadonlySet<number>,
  body: Body,
  lookahead: number,
  throughCoral = false,
): Vec {
  const centre = centreOf(body);
  const start = tileOf(centre);
  if (fieldAt(field, fields, start) === 0) return { ...STILL };

  const path = downhillPath(field, fields, openTiles(level, broken, throughCoral), start, lookahead);
  // The first step is always taken; later ones only while the body can slide straight to them,
  // so the aim never cuts a corner the path itself goes around.
  let target = path[0];
  for (const tile of path.slice(1)) {
    if (!hasClearSweep(level, broken, body, tileCentre(tile))) break;
    target = tile;
  }
  if (!target) return { ...STILL };
  const aim = tileCentre(target);
  const distance = length(aim.x - centre.x, aim.y - centre.y);
  if (distance === 0) return { ...STILL };
  return { x: (aim.x - centre.x) / distance, y: (aim.y - centre.y) / distance };
}

/** Which tiles a downhill walk may enter: open water, plus unbroken coral when `throughCoral`. */
export function openTiles(
  level: Level,
  broken: ReadonlySet<number>,
  throughCoral: boolean,
): (tx: number, ty: number) => boolean {
  return (tx, ty) => !isSolid(level, broken, tx, ty) || (throughCoral && cellAt(level, tx, ty) === 'coral');
}

/**
 * Up to `steps` tiles from `start`, each the lowest neighbour of the last that `open` allows,
 * stopping where nothing is lower. Never cuts a corner `open` refuses.
 */
export function downhillPath(
  field: Float32Array,
  fields: FlowFields,
  open: (tx: number, ty: number) => boolean,
  start: Vec,
  steps: number,
): Vec[] {
  const path: Vec[] = [];
  let tile = start;
  for (let step = 0; step < steps; step++) {
    let next: Vec | null = null;
    let nextValue = fieldAt(field, fields, tile);
    for (const offset of NEIGHBOURS) {
      const candidate = { x: tile.x + offset.x, y: tile.y + offset.y };
      const value = fieldAt(field, fields, candidate);
      if (value >= nextValue || !open(candidate.x, candidate.y) || !cornerIsClear(tile, offset, open)) continue;
      next = candidate;
      nextValue = value;
    }
    if (!next) break;
    path.push(next);
    tile = next;
  }
  return path;
}

/**
 * True when the body's box, slid in a straight line until its centre reaches `to`, stays in
 * non-solid tiles. Each corner is sampled every SIGHT_STEP_PX.
 */
export function hasClearSweep(level: Level, broken: ReadonlySet<number>, body: Body, to: Vec): boolean {
  const from = centreOf(body);
  const halfW = body.w / 2 - EDGE_INSET_PX;
  const halfH = body.h / 2 - EDGE_INSET_PX;
  const samples = Math.ceil(length(to.x - from.x, to.y - from.y) / SIGHT_STEP_PX);
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    for (const corner of CORNER_SIGNS) {
      const tile = tileOf({ x: x + corner.x * halfW, y: y + corner.y * halfH });
      if (isSolid(level, broken, tile.x, tile.y)) return false;
    }
  }
  return true;
}
