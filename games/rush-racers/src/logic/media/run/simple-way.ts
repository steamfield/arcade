/**
 * Run's navigation for phase 2: one uniform-cost distance to the finish over every open tile (rock
 * and unbroken coral closed, ledges open), a one-tile-ahead way over it, a horizontal-only aim, how
 * long to hold Up for each jump height, and the level checks. The distance ignores gravity, so it is
 * a stand-in until the jump-link nav (phase 4); the pilot reads the ground itself to jump.
 */
import { isLedge, isSolid } from '../../level/query.ts';
import { cornerIsClear, distancesToFinish, type EntryCost, fieldAt, NEIGHBOURS } from '../../race/flowfield.ts';
import { type Box, type Level, TILE, type Vec, type World } from '../../types.ts';
import type { LevelProblem, MediumNav, MediumTuning } from '../types.ts';
import { runExtra } from './physics.ts';
import { type RunNav, runNav } from './way-data.ts';

/** How far below a start or a finish tile, in rows, a runner must find ground to stand on. */
export const GROUND_REACH_ROWS = 4;
/** Feet clear the top of what a jump lands on by this much, px, so they don't catch its corner. */
const JUMP_CLEARANCE_PX = 2;
/** The glyph that marks the finish line in a level's ASCII. */
const FINISH_GLYPH = 'F';
/** Level checks judge the level as written, before any coral is broken. */
const NOTHING_BROKEN: ReadonlySet<number> = new Set();
/** Ticks per second the physics steps at. */
const TICKS_PER_SECOND = 60;

/** Every open tile costs the same; rock and unbroken coral are closed. */
export const runCost: EntryCost = (cell, isBroken) => {
  if (cell === 'rock') return Number.POSITIVE_INFINITY;
  if (cell === 'coral' && !isBroken) return Number.POSITIVE_INFINITY;
  return 1;
};

/** Run's nav for `level` with `broken` coral open; jump heights come from `tuning`. */
export function buildRunNav(level: Level, broken: ReadonlySet<number>, tuning: MediumTuning): RunNav {
  return {
    kind: 'run',
    width: level.width,
    height: level.height,
    distance: distancesToFinish(level, broken, runCost),
    jumpHoldTicks: jumpHoldTable(tuning),
  };
}

/**
 * The ticks of Up a jump needs to land on ground 0, 1, 2... tiles higher, up to the highest a full
 * jump reaches. Worked out by stepping the jump the way the physics does: a jump speed, gravity, and
 * the heavier gravity while rising with Up let go.
 *
 * @throws {Error} When `tuning` lacks run's extras (see `runExtra`).
 */
function jumpHoldTable(tuning: MediumTuning): number[] {
  const extra = runExtra(tuning);
  const fullHold = Math.ceil((extra.jumpSpeed / extra.gravity) * TICKS_PER_SECOND);
  const table = [0];
  for (let hold = 1; hold <= fullHold; hold++) {
    const peak = jumpPeak(extra, hold);
    while (table.length * TILE + JUMP_CLEARANCE_PX <= peak) table.push(hold);
  }
  return table;
}

/** How high, px, a jump with Up held for `holdTicks` lifts the feet. */
function jumpPeak(extra: ReturnType<typeof runExtra>, holdTicks: number): number {
  const dt = 1 / TICKS_PER_SECOND;
  let vy = -extra.jumpSpeed;
  let rise = 0;
  for (let tick = 0; vy < 0; tick++) {
    const cut = tick < holdTicks ? 1 : extra.cutGravityMul;
    vy += extra.gravity * cut * dt;
    rise -= Math.min(vy, 0) * dt;
  }
  return rise;
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

/** True when a runner on `tile` would land on rock, coral or a ledge within GROUND_REACH_ROWS rows below it. */
function hasGroundBelow(level: Level, tile: Vec): boolean {
  for (let row = tile.y + 1; row <= tile.y + GROUND_REACH_ROWS; row++) {
    if (isSolid(level, NOTHING_BROKEN, tile.x, row) || isLedge(level, tile.x, row)) return true;
  }
  return false;
}

/**
 * Why `level` can't be raced on foot: a start that can't reach the finish, a start with no ground
 * close below it, and a finish column with no tile a runner could stand near. Starts are located at
 * the start; the finish problem at its column.
 *
 * @throws {Error} When `nav` was built by another medium.
 */
export function validateRunLevel(level: Level, nav: MediumNav): LevelProblem[] {
  return [...startProblems(level, runNav(nav)), ...finishProblems(level)];
}

/** One problem per start that can't reach the finish, and one per start with no ground close below it. */
function startProblems(level: Level, nav: RunNav): LevelProblem[] {
  return level.starts.flatMap((start, index) => {
    const at = { row: start.y, col: start.x };
    const problems: LevelProblem[] = [];
    if (!Number.isFinite(fieldAt(nav.distance, nav, start))) {
      problems.push({ message: `Start ${index + 1} cannot reach the finish running`, ...at });
    }
    if (!hasGroundBelow(level, start)) {
      problems.push({
        message: `Start ${index + 1} has no ground within ${GROUND_REACH_ROWS} rows below it; put a floor under it`,
        ...at,
      });
    }
    return problems;
  });
}

/** A problem when no finish tile (`F`) has ground close below it, so no runner reaches the line. */
function finishProblems(level: Level): LevelProblem[] {
  const column = level.finishX;
  for (let row = 0; row < level.height; row++) {
    if (level.glyphs[row]?.[column] === FINISH_GLYPH && hasGroundBelow(level, { x: column, y: row })) return [];
  }
  return [
    {
      message: `No finish tile in col ${column} has ground within ${GROUND_REACH_ROWS} rows below it; a runner can't reach the line`,
      row: null,
      col: column,
    },
  ];
}
