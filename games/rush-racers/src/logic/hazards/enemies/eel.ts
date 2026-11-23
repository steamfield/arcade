/**
 * Eels: hide in a wall hole beside their home tile and lunge straight out of it on a fixed cycle.
 *
 * Modes: 'hidden' → 'windup' (the warning, EEL.telegraphTicks, `enemy.telegraphed`) → 'lunge'
 * (EEL.lungeTicks: out EEL.lungeTiles and back) → 'hidden', one round every EEL.cycleTicks. Only while
 * lunging can it hit or be bonked. Its centre sits on its home tile centre except mid-lunge. Each eel
 * starts partway through its cycle by an offset worked out from its home tile (`startEel`), so eels
 * near each other lunge out of step. Deterministic: no randomness.
 */
import { LevelError } from '../../level/parse.ts';
import { cellAt } from '../../level/query.ts';
import { type Box, type Enemy, type EnemyMode, type Level, TILE, type Vec, type World } from '../../types.ts';
import { EEL } from './tuning.ts';

/** Sides an eel's hole may be on, in the order they are tried, each with the way it lunges from there. */
const HOLES: readonly { wall: Vec; out: Vec }[] = [
  { wall: { x: -1, y: 0 }, out: { x: 1, y: 0 } },
  { wall: { x: 1, y: 0 }, out: { x: -1, y: 0 } },
  { wall: { x: 0, y: -1 }, out: { x: 0, y: 1 } },
  { wall: { x: 0, y: 1 }, out: { x: 0, y: -1 } },
];

const HIDDEN_TICKS = EEL.cycleTicks - EEL.telegraphTicks - EEL.lungeTicks;

/**
 * Ticks of start offset per column and per row of an eel's home tile. A column step shifts an eel's
 * start by 37 ticks and a row step by 11; neither shares a factor with EEL.cycleTicks, so eels in a
 * row or a column spread through the cycle, though some nearby diagonal pairs land within a few ticks.
 */
const START_TICKS_PER_COL = 37;
const START_TICKS_PER_ROW = 11;

/**
 * The unit direction an eel at `home` lunges: away from the first rock beside it, trying left, right,
 * above, then below. `createEnemies` calls it once and stores the result as `enemy.out`.
 *
 * @throws {LevelError} With the tile's row and col when no orthogonal neighbour is rock, or when the
 *   EEL.lungeTiles tiles it would lunge across aren't all open water.
 */
export function eelOutward(level: Level, home: Vec): Vec {
  const hole = HOLES.find(({ wall }) => cellAt(level, home.x + wall.x, home.y + wall.y) === 'rock');
  if (!hole) {
    throw new LevelError(
      `Eel at row ${home.y}, col ${home.x} needs rock beside it (left, right, above or below) to hide in`,
      home.y,
      home.x,
    );
  }
  for (let step = 1; step <= EEL.lungeTiles; step++) {
    if (cellAt(level, home.x + hole.out.x * step, home.y + hole.out.y * step) === 'water') continue;
    throw new LevelError(
      `Eel at row ${home.y}, col ${home.x} needs ${EEL.lungeTiles} tiles of open water in front of its hole to lunge into`,
      home.y,
      home.x,
    );
  }
  return hole.out;
}

/**
 * Sets a newly made eel to where its start offset, `(home.x * START_TICKS_PER_COL + home.y * START_TICKS_PER_ROW) % EEL.cycleTicks`
 * ticks, falls in its hidden → windup → lunge cycle, and places it there (out of its hole when that is
 * mid-lunge). Emits nothing: an eel that starts in its warning telegraphs at its next one.
 */
export function startEel(eel: Enemy): void {
  const offset = (eel.home.x * START_TICKS_PER_COL + eel.home.y * START_TICKS_PER_ROW) % EEL.cycleTicks;
  if (offset < HIDDEN_TICKS) {
    eel.mode = 'hidden';
    eel.modeTicks = offset;
  } else if (offset < HIDDEN_TICKS + EEL.telegraphTicks) {
    eel.mode = 'windup';
    eel.modeTicks = offset - HIDDEN_TICKS;
  } else {
    eel.mode = 'lunge';
    eel.modeTicks = offset - HIDDEN_TICKS - EEL.telegraphTicks;
  }
  placeEel(eel);
}

/**
 * One eel's tick through its cycle. Emits `enemy.telegraphed` as the warning starts.
 *
 * @param index The eel's place in `world.enemies`, for events.
 */
export function stepEel(world: World, eel: Enemy, index: number): void {
  eel.modeTicks += 1;
  if (eel.mode === 'hidden' && eel.modeTicks >= HIDDEN_TICKS) {
    enter(eel, 'windup');
    world.events.emit({ type: 'enemy.telegraphed', index, kind: 'eel' });
  } else if (eel.mode === 'windup' && eel.modeTicks >= EEL.telegraphTicks) {
    enter(eel, 'lunge');
  } else if (eel.mode === 'lunge' && eel.modeTicks >= EEL.lungeTicks) {
    enter(eel, 'hidden');
  }
  placeEel(eel);
}

/**
 * Where the eel's centre is: its home tile centre, pushed out along `enemy.out` by a triangle that
 * peaks at EEL.lungeTiles halfway through the lunge.
 */
function placeEel(eel: Enemy): void {
  const { out } = eel;
  const half = EEL.lungeTicks / 2;
  const reach = eel.mode === 'lunge' ? (EEL.lungeTiles * TILE * (half - Math.abs(eel.modeTicks - half))) / half : 0;
  eel.at = { x: (eel.home.x + 0.5) * TILE + out.x * reach, y: (eel.home.y + 0.5) * TILE + out.y * reach };
  eel.facing = out.x < 0 ? -1 : 1;
}

/** The tile span an eel can reach from home, as a box in world px: what a rival steers clear of. */
export function eelReachBox(eel: Enemy): Box {
  const size = EEL.size;
  const { out } = eel;
  const cx = (eel.home.x + 0.5) * TILE;
  const cy = (eel.home.y + 0.5) * TILE;
  const ex = cx + out.x * EEL.lungeTiles * TILE;
  const ey = cy + out.y * EEL.lungeTiles * TILE;
  const x = Math.min(cx, ex) - size / 2;
  const y = Math.min(cy, ey) - size / 2;
  return { x, y, w: Math.abs(ex - cx) + size, h: Math.abs(ey - cy) + size };
}

function enter(eel: Enemy, mode: EnemyMode): void {
  eel.mode = mode;
  eel.modeTicks = 0;
}
