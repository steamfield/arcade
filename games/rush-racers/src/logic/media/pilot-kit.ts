/**
 * The parts of a rival pilot that swim and drift share: the bounded wobble on the aim, the
 * speed-based stuck recovery that pushes sideways off whatever a rival is pinned against, the dash
 * reserve kept back for shaking off a latch, and how much looser a rival steers in a dark zone it
 * can't see in. Each pilot keeps its own aim, kick and memory shape; these read and write only the
 * fields in `SteeringMemory`. Run's and flight's pilots steer their own way and don't use this.
 */
import { cos, length, sin } from '../num.ts';
import { canDash, dashCharges } from '../powerups/dash-meter.ts';
import type { Racer, Vec, World } from '../types.ts';

/** The pilot memory fields the shared steering reads and writes. */
export interface SteeringMemory {
  /** The aim along the field, before wobble. */
  aim: Vec;
  /** The current angle of the bounded random walk on the aim, in radians. */
  wobble: number;
  /** Racing ticks spent below STUCK_SPEED in a row. */
  stuckTicks: number;
  /** Ticks left in the current recovery push; 0 when not recovering. */
  recoverTicks: number;
  /** The direction of the current recovery push. */
  recoverDir: Vec;
}

/** How much looser a rival steers in a dark zone it can't see in: wobble bound and reaction time multipliers. */
export const DARK_STEERING = { wobbleMul: 2, reactionMul: 2 } as const;

/** Tiles down the field a rival aims at. */
export const LOOKAHEAD_TILES = 3;

/** Largest change in wobble per tick, as a fraction of the profile's wobble bound. */
const WOBBLE_STEP = 0.15;
/** Dash charges a rival keeps back for shaking off a latch. */
const DASH_RESERVE = 1;
/** Places behind the leader past which a rival stops keeping a reserve and dashes everything. */
const RESERVE_WAIVED_BEHIND = 2;
/** Below this speed in px/s a racing rival counts as stuck. */
const STUCK_SPEED = 8;
/** Racing ticks below STUCK_SPEED before a recovery push starts. */
const STUCK_TICKS = 30;
/** Ticks a recovery push is held. */
const RECOVER_TICKS = 20;

/** One step of the bounded random walk on the steering angle. */
export function stepWobble(memory: SteeringMemory, bound: number, draw: number): void {
  const step = (draw * 2 - 1) * bound * WOBBLE_STEP;
  memory.wobble = Math.max(-bound, Math.min(bound, memory.wobble + step));
}

/** The memory's aim turned by its wobble angle. */
export function wobbledAim(memory: SteeringMemory): Vec {
  const c = cos(memory.wobble);
  const s = sin(memory.wobble);
  return { x: memory.aim.x * c - memory.aim.y * s, y: memory.aim.x * s + memory.aim.y * c };
}

/**
 * Stuck recovery runs only while racing and free to move. A stunned or trapped rival sits still
 * through no fault of its steering, so that time resets its stuck count instead.
 */
export function canRecover(world: World, racer: Racer, memory: SteeringMemory): boolean {
  if (world.race.phase !== 'racing') return false;
  if (racer.status.stunned > 0 || racer.status.trapped > 0) {
    memory.stuckTicks = 0;
    return false;
  }
  return true;
}

/**
 * The sideways push of a racer that has sat nearly still too long (or that `forceRecover` sends),
 * held for RECOVER_TICKS to slide off whatever it is pinned against; null while it isn't recovering.
 */
export function recoveryMove(
  racer: Racer,
  memory: SteeringMemory,
  sideDraw: number,
  forceRecover: boolean,
): Vec | null {
  if (memory.recoverTicks === 0) {
    const speed = length(racer.body.vx, racer.body.vy);
    memory.stuckTicks = speed < STUCK_SPEED ? memory.stuckTicks + 1 : 0;
    if (memory.stuckTicks < STUCK_TICKS && !forceRecover) return null;
    memory.stuckTicks = 0;
    memory.recoverTicks = RECOVER_TICKS;
    memory.recoverDir = sidewaysFrom(memory.aim, racer.facing, sideDraw < 0.5 ? 1 : -1);
  }
  memory.recoverTicks--;
  return { ...memory.recoverDir };
}

/** Perpendicular to the aim on the given side; to the facing when there is no aim yet. */
function sidewaysFrom(aim: Vec, facing: 1 | -1, side: 1 | -1): Vec {
  const forward = aim.x === 0 && aim.y === 0 ? { x: facing, y: 0 } : aim;
  return { x: -forward.y * side, y: forward.x * side };
}

/**
 * Whether the rival has a dash charge to spend now. It never dashes on an empty meter, and keeps
 * DASH_RESERVE charges back for shaking off a latch unless it is latched already or trails the
 * leader by more than RESERVE_WAIVED_BEHIND places.
 */
export function hasDashToSpend(racer: Racer): boolean {
  if (!canDash(racer)) return false;
  if (racer.status.latched > 0 || racer.place - 1 > RESERVE_WAIVED_BEHIND) return true;
  return dashCharges(racer) > DASH_RESERVE;
}
