/**
 * Run's navigation for phase 2: one uniform-cost distance to the finish over every open tile (rock
 * and unbroken coral closed, ledges open), a one-tile-ahead way over it, a horizontal-only aim, and a
 * level check. It ignores gravity, so it is a stand-in until the jump-link nav (phase 4).
 *
 * Scaffold baseline; phase 2 lane b owns this file.
 */
import { isSolid } from '../../level/query.ts';
import { cornerIsClear, distancesToFinish, type EntryCost, fieldAt, NEIGHBOURS } from '../../race/flowfield.ts';
import { type Box, type Level, TILE, type Vec, type World } from '../../types.ts';
import type { LevelProblem, MediumNav, MediumTuning } from '../types.ts';
import { type RunNav, runNav } from './way-data.ts';

/** Every open tile costs the same; rock and unbroken coral are closed. */
export const runCost: EntryCost = (cell, isBroken) => {
  if (cell === 'rock') return Number.POSITIVE_INFINITY;
  if (cell === 'coral' && !isBroken) return Number.POSITIVE_INFINITY;
  return 1;
};

/** Run's nav for `level` with `broken` coral open. */
export function buildRunNav(level: Level, broken: ReadonlySet<number>, _tuning: MediumTuning): RunNav {
  return { kind: 'run', width: level.width, height: level.height, distance: distancesToFinish(level, broken, runCost) };
}

/**
 * The distance to the finish from `tile`; Infinity off the grid or where it can't be reached.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function runDistanceAt(world: World, tile: Vec): number {
  const nav = runNav(world.nav);
  return fieldAt(nav.distance, nav, tile);
}

/**
 * Offset of the open neighbour of `tile` nearest the finish, never across a closed corner; null at the
 * finish or boxed in.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function runNextTile(world: World, tile: Vec): Vec | null {
  const open = (tx: number, ty: number) => !isSolid(world.level, world.broken, tx, ty);
  let best: Vec | null = null;
  let bestDistance = runDistanceAt(world, tile);
  for (const offset of NEIGHBOURS) {
    const distance = runDistanceAt(world, { x: tile.x + offset.x, y: tile.y + offset.y });
    if (distance >= bestDistance || !open(tile.x + offset.x, tile.y + offset.y) || !cornerIsClear(tile, offset, open)) {
      continue;
    }
    best = offset;
    bestDistance = distance;
  }
  return best ? { ...best } : null;
}

/**
 * Horizontal unit aim toward the next tile on the way: `{x: ±1, y: 0}`, or zero at the finish or when
 * the way goes straight up or down. Always horizontal, so the Easy steering assist never presses Up.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function runAimFrom(world: World, body: Box, _lookaheadTiles: number): Vec {
  const centre = { x: body.x + body.w / 2, y: body.y + body.h / 2 };
  const tile = { x: Math.floor(centre.x / TILE), y: Math.floor(centre.y / TILE) };
  const step = runNextTile(world, tile);
  if (!step || step.x === 0) return { x: 0, y: 0 };
  return { x: Math.sign(step.x), y: 0 };
}

/**
 * One problem for each start that can't reach the finish, located at that start.
 *
 * @throws {Error} When `nav` was built by another medium.
 */
export function validateRunLevel(level: Level, nav: MediumNav): LevelProblem[] {
  const run = runNav(nav);
  return level.starts.flatMap((start, index) =>
    Number.isFinite(fieldAt(run.distance, run, start))
      ? []
      : [{ message: `Start ${index + 1} cannot reach the finish running`, row: start.y, col: start.x }],
  );
}
