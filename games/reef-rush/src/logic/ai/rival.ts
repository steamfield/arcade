/**
 * Computer-driven swimming: a racer's Intent each tick from the steer field,
 * its profile, its memory and its own random stream.
 *
 * Every call draws exactly three numbers from the racer's rng (wobble, kick
 * roll, recovery side) whether or not they are used, so one racer's choices
 * never shift the rest of its stream.
 */
import type { Rng } from '@arcade/core';
import { steerDirection } from '../race/flowfield.ts';
import type { AiMemory, Intent, Racer, Vec, World } from '../types.ts';

/** Bounds of the catch-up multiplier on swim force, and its slope per tile of gap to the player. */
export const CATCH_UP = { perTile: 0.004, min: 0.9, max: 1.08 } as const;

/** Tiles down the steer field a rival aims at. */
const LOOKAHEAD_TILES = 3;
/** Largest change in wobble per tick, as a fraction of the profile's wobble bound. */
const WOBBLE_STEP = 0.15;
/** Kick only when the aim is within about 37 degrees of the way the racer is already moving. */
const KICK_ALIGNMENT = 0.8;
/** Below this speed in px/s a racing rival counts as stuck. */
const STUCK_SPEED = 8;
const STUCK_TICKS = 30;
const RECOVER_TICKS = 20;

/** The rng draws for one tick, taken up front so their number never varies. */
interface Draws {
  wobble: number;
  kick: number;
  side: number;
}

/** Fresh memory for a racer at the start line. */
export function createAiMemory(): AiMemory {
  return { wobble: 0, stuckTicks: 0, recoverTicks: 0, recoverDir: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, replanIn: 0 };
}

/**
 * Decides a racer's intent for this tick. Reads the world, mutates only `racer.ai`,
 * and consumes the same number of rng draws every tick so streams stay aligned.
 *
 * @throws {Error} When `racer.ai` is null.
 */
export function rivalIntent(world: World, racer: Racer, rng: Rng): Intent {
  const memory = racer.ai;
  if (!memory) throw new Error(`rivalIntent needs AI memory, but racer '${racer.id}' has none (a human drives it)`);
  const draws: Draws = { wobble: rng.next(), kick: rng.next(), side: rng.next() };

  replanAim(world, racer, memory);
  stepWobble(memory, racer.profile.wobble, draws.wobble);
  const aim = wobbledAim(memory);
  const recovery = world.race.phase === 'racing' ? recoveryMove(racer, memory, draws.side) : null;
  // A recovering rival is sliding off a wall, not racing, so it saves its kick for the aim.
  const kick = recovery === null && wantsKick(racer, aim, draws.kick);
  return { move: recovery ?? aim, kick, burst: false };
}

/** Re-reads the steer field every `reactionTicks`, so slower rivals react later to the course. */
function replanAim(world: World, racer: Racer, memory: AiMemory): void {
  if (memory.replanIn <= 0) {
    const { fields, level, broken } = world;
    memory.aim = steerDirection(fields.steer, fields, level, broken, racer.body, LOOKAHEAD_TILES);
    memory.replanIn = racer.profile.reactionTicks;
  }
  memory.replanIn--;
}

/** One step of the bounded random walk on the steering angle. */
function stepWobble(memory: AiMemory, bound: number, draw: number): void {
  const step = (draw * 2 - 1) * bound * WOBBLE_STEP;
  memory.wobble = Math.max(-bound, Math.min(bound, memory.wobble + step));
}

function wobbledAim(memory: AiMemory): Vec {
  const cos = Math.cos(memory.wobble);
  const sin = Math.sin(memory.wobble);
  return { x: memory.aim.x * cos - memory.aim.y * sin, y: memory.aim.x * sin + memory.aim.y * cos };
}

/**
 * The sideways swim of a racer that has sat nearly still too long, held for RECOVER_TICKS to
 * slide off whatever it is pinned against; null while it isn't recovering.
 */
function recoveryMove(racer: Racer, memory: AiMemory, sideDraw: number): Vec | null {
  if (memory.recoverTicks === 0) {
    const speed = Math.hypot(racer.body.vx, racer.body.vy);
    memory.stuckTicks = speed < STUCK_SPEED ? memory.stuckTicks + 1 : 0;
    if (memory.stuckTicks < STUCK_TICKS) return null;
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

/** Kicks when ready, already moving roughly along its aim, and the skill roll passes. */
function wantsKick(racer: Racer, aim: Vec, roll: number): boolean {
  if (racer.kickCooldown > 0) return false;
  const { vx, vy } = racer.body;
  const speed = Math.hypot(vx, vy);
  if (speed === 0) return false;
  const alignment = (aim.x * vx + aim.y * vy) / speed;
  return alignment > KICK_ALIGNMENT && roll < racer.profile.kickSkill;
}

/**
 * Force multiplier that keeps races close: below 1 when the racer is ahead of the player,
 * above 1 when behind, clamped to CATCH_UP.
 *
 * @returns Exactly 1 while either racer's progress is unknown (Infinity before the first read).
 */
export function catchUpMul(racer: Racer, player: Racer): number {
  if (!Number.isFinite(racer.progress) || !Number.isFinite(player.progress)) return 1;
  const gapTiles = racer.progress - player.progress;
  const boost = gapTiles * CATCH_UP.perTile;
  return 1 + Math.max(CATCH_UP.min - 1, Math.min(CATCH_UP.max - 1, boost));
}
