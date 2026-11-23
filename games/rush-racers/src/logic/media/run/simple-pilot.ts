/**
 * Run's rival pilot for phase 2: run along the way, read the ground just ahead to jump walls, pits,
 * climbs and ledges (holding Up only as long as the height needs), and dash on flat ground. When the
 * generic backstop sends `forceRecover`, back off from the finish, then jump toward it. Phase 4
 * replaces it with a pilot that follows jump links.
 */
import { isLedge, isSolid } from '../../level/query.ts';
import { canDash } from '../../powerups/dash-meter.ts';
import { type MoveModifiers, type Racer, TILE, type Vec, type World } from '../../types.ts';
import type { AiDraws, Steering } from '../types.ts';
import { runMotion } from './data.ts';
import { runAimFrom, runNextTile } from './simple-way.ts';
import { type RunNav, type RunPilot, runNav, runPilot } from './way-data.ts';

/** Ticks a forced recovery lasts: it backs off first, then jumps for its last RECOVER_JUMP_TICKS. */
const RECOVER_TICKS = 30;
/** Ticks at the end of a recovery spent jumping toward the finish with Up held. */
const RECOVER_JUMP_TICKS = 18;
/** How far past its front edge, px, a runner looks for the edge of a pit: late, so the jump carries furthest. */
const PIT_LOOKAHEAD_PX = 4;
/**
 * Ticks of Up for a full jump: past the top of any jump the tuning allows, since holding on after the
 * top changes nothing. Pits and blind climbs get it, because they need distance more than height.
 */
const FULL_JUMP_HOLD_TICKS = 30;
/** Tiles of flat, open ground ahead a rival wants before it dashes. */
const DASH_CLEAR_TILES = 3;

/** A jump as long and high as it goes, rather than onto ground of a known height. */
const FULL_JUMP = 'full';
/** Tiles of height a jump has to gain, or a full jump. */
type JumpRise = number | typeof FULL_JUMP;

/** The tile column under a runner's centre and the row its feet are in. */
interface Footing {
  col: number;
  row: number;
}

/** A run rival's pilot memory at the start line. */
export function createRunPilot(): RunPilot {
  return { kind: 'run', holdUpTicks: 0, upHeld: false, recoverTicks: 0, recoverDir: 1 };
}

/**
 * A run rival's steering this tick. Mutates only its pilot memory.
 *
 * @throws {Error} When `racer.ai` is null (a human drives it), or its memory, motion or the world's nav isn't run's.
 */
export function steerRunner(
  world: World,
  racer: Racer,
  _mods: MoveModifiers,
  draws: AiDraws,
  forceRecover: boolean,
): Steering {
  const ai = racer.ai;
  if (!ai) throw new Error(`run.steer needs AI memory, but racer '${racer.id}' has none (a human drives it)`);
  const memory = runPilot(ai.pilot);
  const aim = runAimFrom(world, racer.body, 1);
  const dir = aim.x === 0 ? racer.facing : aim.x < 0 ? -1 : 1;
  if (forceRecover && memory.recoverTicks === 0) {
    memory.recoverTicks = RECOVER_TICKS;
    memory.recoverDir = dir;
    memory.holdUpTicks = 0;
  }
  if (memory.recoverTicks > 0)
    return { move: recoveryMove(memory), kick: false, kickHeld: false, aim, recovering: true };

  const grounded = runMotion(racer.motion).grounded;
  if (grounded && memory.holdUpTicks === 0 && !memory.upHeld) {
    const rise = jumpRise(world, racer, dir);
    if (rise !== null) memory.holdUpTicks = holdTicksFor(runNav(world.nav), rise);
  }
  const up = memory.holdUpTicks > 0;
  if (up) memory.holdUpTicks--;
  memory.upHeld = up;
  const kick = grounded && !up && wantsDash(world, racer, dir, draws.kick);
  return { move: { x: dir, y: up ? -1 : 0 }, kick, kickHeld: kick, aim, recovering: false };
}

/** One tick of a forced recovery: away from the finish first, then toward it with Up held. */
function recoveryMove(memory: RunPilot): Vec {
  memory.recoverTicks--;
  const jumping = memory.recoverTicks < RECOVER_JUMP_TICKS;
  memory.upHeld = jumping;
  return jumping ? { x: memory.recoverDir, y: -1 } : { x: -memory.recoverDir, y: 0 };
}

/** Ticks of Up for a jump onto ground `rise` tiles higher; a full jump for `FULL_JUMP` or out of reach. */
function holdTicksFor(nav: RunNav, rise: JumpRise): number {
  if (rise === FULL_JUMP) return FULL_JUMP_HOLD_TICKS;
  return nav.jumpHoldTicks[rise] ?? FULL_JUMP_HOLD_TICKS;
}

/**
 * How many tiles higher the ground a jump should land on is, or null when no jump is needed: a wall
 * it can clear, a pit at its feet (a full jump), a ledge above when the wall ahead is too high or the
 * way goes straight up, or such a climb with no ledge in sight (a full jump). A way that only slants
 * upward doesn't count: the uniform distance ties a slant with a run along the floor, so it says
 * nothing about where a runner must leave the ground.
 */
function jumpRise(world: World, racer: Racer, dir: -1 | 1): JumpRise | null {
  const reach = runNav(world.nav).jumpHoldTicks.length - 1;
  const at = footingOf(racer);
  const wall = wallRise(world, at.col + dir, at.row);
  if (wall !== null && wall <= reach) return wall;
  if (pitAhead(world, racer, dir, at.row)) return FULL_JUMP;
  const step = runNextTile(world, { x: at.col, y: at.row });
  const climbs = wall !== null || (step !== null && step.x === 0 && step.y < 0);
  if (!climbs) return null;
  return ledgeRise(world, at, dir, reach) ?? FULL_JUMP;
}

/** Where a runner stands, in tiles. */
function footingOf(racer: Racer): Footing {
  const { body } = racer;
  return { col: Math.floor((body.x + body.w / 2) / TILE), row: Math.floor((body.y + body.h - 1) / TILE) };
}

/** Rock, coral or a ledge: something a runner can stand on. */
function isGround(world: World, col: number, row: number): boolean {
  return isSolid(world.level, world.broken, col, row) || isLedge(world.level, col, row);
}

/** Height in tiles of the wall in column `col` from the feet's row up, or null when that tile is open. */
function wallRise(world: World, col: number, feetRow: number): number | null {
  if (!isSolid(world.level, world.broken, col, feetRow)) return null;
  let top = feetRow;
  while (top > 0 && isSolid(world.level, world.broken, col, top - 1)) top--;
  return feetRow - top + 1;
}

/** True when the column just past the runner's front edge has nothing to stand on all the way down. */
function pitAhead(world: World, racer: Racer, dir: -1 | 1, feetRow: number): boolean {
  const front = dir > 0 ? racer.body.x + racer.body.w : racer.body.x;
  const col = Math.floor((front + dir * PIT_LOOKAHEAD_PX) / TILE);
  if (isSolid(world.level, world.broken, col, feetRow)) return false;
  for (let row = feetRow + 1; row < world.level.height; row++) {
    if (isGround(world, col, row)) return false;
  }
  return true;
}

/** Tiles up to the nearest ledge within reach above the runner's column or the next one, or null. */
function ledgeRise(world: World, at: Footing, dir: -1 | 1, reach: number): number | null {
  for (let rise = 2; rise <= reach; rise++) {
    // Standing on a ledge `rise` tiles up puts the ledge itself `rise - 1` rows above the feet.
    const row = at.row - rise + 1;
    if (isLedge(world.level, at.col, row) || isLedge(world.level, at.col + dir, row)) return rise;
  }
  return null;
}

/** Dashes when the dash is ready, it is already running toward `dir`, the ground ahead is flat, and the skill roll passes. */
function wantsDash(world: World, racer: Racer, dir: -1 | 1, roll: number): boolean {
  if (racer.kickCooldown > 0 || !canDash(racer)) return false;
  if (Math.sign(racer.body.vx) !== dir) return false;
  const at = footingOf(racer);
  for (let tiles = 1; tiles <= DASH_CLEAR_TILES; tiles++) {
    const col = at.col + dir * tiles;
    if (isSolid(world.level, world.broken, col, at.row) || !isGround(world, col, at.row + 1)) return false;
  }
  return roll < racer.profile.kickSkill;
}
