/**
 * Run's rival pilot: it follows the best link out of the stand tile it is on. It runs toward a walk
 * or a drop, starts a jump at the link's take-off with Up held for the link's hold ticks, steers in
 * the air toward the tile it means to land on, lets go of Up before it lands, and plans again from
 * where it stands. It dashes on flat ground. When the generic backstop sends `forceRecover`, it backs
 * off from the finish, then jumps toward it.
 */
import { isLedge, isSolid } from '../../level/query.ts';
import { canDash } from '../../powerups/dash-meter.ts';
import { type MoveModifiers, type Racer, TILE, type Vec, type World } from '../../types.ts';
import type { AiDraws, Steering } from '../types.ts';
import { runMotion } from './data.ts';
import { runAimFrom } from './way.ts';
import { type RunLink, type RunNav, type RunPilot, runNav, runPilot } from './way-data.ts';

/** Ticks a forced recovery lasts: it backs off first, then jumps for its last RECOVER_JUMP_TICKS. */
const RECOVER_TICKS = 30;
/** Ticks at the end of a recovery spent jumping toward the finish with Up held. */
const RECOVER_JUMP_TICKS = 18;
/** How far short of a link's take-off point, px, a runner may start the jump. */
const TAKEOFF_SLACK_PX = 2;
/** In the air, a runner within this many px of the middle of its landing tile stops steering. */
const LANDING_DEADBAND_PX = 3;
/** Tiles of flat, open ground ahead a rival wants before it dashes. */
const DASH_CLEAR_TILES = 3;

/** The tile column under a runner's centre and the row its feet are in. */
interface Footing {
  col: number;
  row: number;
}

/** A run rival's pilot memory at the start line. */
export function createRunPilot(): RunPilot {
  return {
    kind: 'run',
    holdUpTicks: 0,
    upHeld: false,
    inFlight: false,
    planTile: null,
    landingTile: null,
    recoverTicks: 0,
    recoverDir: 1,
  };
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
  const grounded = runMotion(racer.motion).grounded;
  if (grounded && memory.inFlight) startOver(memory);
  memory.inFlight = !grounded;

  const aim = runAimFrom(world, racer.body, 1);
  const heading = aim.x === 0 ? racer.facing : aim.x < 0 ? -1 : 1;
  if (forceRecover && memory.recoverTicks === 0) {
    memory.recoverTicks = RECOVER_TICKS;
    memory.recoverDir = heading;
    memory.holdUpTicks = 0;
  }
  if (memory.recoverTicks > 0) {
    return { move: recoveryMove(memory, grounded), kick: false, kickHeld: false, aim, recovering: true };
  }

  const nav = runNav(world.nav);
  const stand = grounded ? followedStand(nav, racer, memory) : null;
  const link = stand === null ? null : (nav.best[stand] ?? null);
  if (grounded) memory.landingTile = link?.to ?? null;
  if (stand !== null && link?.kind === 'jump' && canPress(memory) && atTakeOff(nav, racer, stand, link)) {
    memory.holdUpTicks = link.holdTicks;
  }
  const up = memory.holdUpTicks > 0;
  if (up) memory.holdUpTicks--;
  memory.upHeld = up;
  const x = grounded ? (link?.dir ?? heading) : airSteer(nav, racer, memory.landingTile, heading);
  const kick = grounded && !up && link?.kind === 'walk' && wantsDash(world, racer, link.dir, draws.kick);
  return { move: { x, y: up ? -1 : 0 }, kick, kickHeld: kick, aim, recovering: false };
}

/**
 * One tick of a forced recovery: away from the finish first, then toward it with Up held. The jump
 * waits for the runner to stand, so a recovery that starts in the air doesn't spend its press where
 * no jump can fire.
 */
function recoveryMove(memory: RunPilot, grounded: boolean): Vec {
  const jumpPhase = memory.recoverTicks <= RECOVER_JUMP_TICKS;
  if (jumpPhase && !memory.upHeld && !grounded) return { x: memory.recoverDir, y: 0 };
  memory.recoverTicks--;
  memory.upHeld = jumpPhase;
  return jumpPhase ? { x: memory.recoverDir, y: -1 } : { x: -memory.recoverDir, y: 0 };
}

/** Where a runner stands, in tiles. */
function footingOf(racer: Racer): Footing {
  const { body } = racer;
  return { col: Math.floor((body.x + body.w / 2) / TILE), row: Math.floor((body.y + body.h - 1) / TILE) };
}

/** Forgets the plan and any Up still to hold: the runner has landed and plans again from where it stands. */
function startOver(memory: RunPilot): void {
  memory.holdUpTicks = 0;
  memory.planTile = null;
}

/** True when a new jump can start: no Up left to hold, and Up was let go of last tick. */
function canPress(memory: RunPilot): boolean {
  return memory.holdUpTicks === 0 && !memory.upHeld;
}

/**
 * The stand tile whose best link a grounded runner follows. On a stand tile that is the tile itself;
 * once the runner's middle is past an edge the plan it made on the tile it left stays, so a runner
 * running off the edge still takes the jump or drop planned there. With no plan (it just landed on a
 * corner), the stand tile its tile reads.
 */
function followedStand(nav: RunNav, racer: Racer, memory: RunPilot): number | null {
  const { col, row } = footingOf(racer);
  const tile = row * nav.width + col;
  const anchor = nav.anchor[tile] ?? -1;
  if (anchor === tile) memory.planTile = tile;
  else if (memory.planTile === null && anchor >= 0) memory.planTile = anchor;
  return memory.planTile;
}

/** True when the runner has run up to where its jump link takes off, or past it: the middle of the stand tile, or its far edge for a jump over a gap. */
function atTakeOff(nav: RunNav, racer: Racer, stand: number, link: RunLink): boolean {
  const toEdge = link.takeOffAtEdge ? (link.dir * TILE) / 2 : 0;
  const takeOffX = ((stand % nav.width) + 0.5) * TILE + toEdge;
  const centreX = racer.body.x + racer.body.w / 2;
  return (centreX - takeOffX) * link.dir >= -TAKEOFF_SLACK_PX;
}

/** Horizontal stick in the air: toward the middle of the tile it means to land on, else toward the finish. */
function airSteer(nav: RunNav, racer: Racer, landingTile: number | null, heading: -1 | 1): number {
  if (landingTile === null) return heading;
  const offset = ((landingTile % nav.width) + 0.5) * TILE - (racer.body.x + racer.body.w / 2);
  return Math.abs(offset) <= LANDING_DEADBAND_PX ? 0 : Math.sign(offset);
}

/** Rock, coral or a ledge: something a runner can stand on. */
function isGround(world: World, col: number, row: number): boolean {
  return isSolid(world.level, world.broken, col, row) || isLedge(world.level, col, row);
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
