/**
 * Computer-driven swimming: a racer's Intent each tick from the steer field
 * (the smash field while it holds a Puffer it can use: inflated, or its burst
 * ready), its profile, its memory and its own random stream.
 *
 * A stunned or trapped rival can't act, so its stuck counter resets and it
 * starts no recovery swim; a rival recovering from being stuck never bursts.
 *
 * Every call draws exactly four numbers from the racer's rng, in this order,
 * whether or not they are used: wobble, kick roll, recovery side, item roll.
 * So one racer's choices, and what it holds, never shift the rest of its stream.
 */
import type { Rng } from '@arcade/core';
import { cos, length, sin } from '../num.ts';
import type { AiMemory, Intent, Racer, Vec, World } from '../types.ts';
import { wantsBurst } from './items.ts';
import { steerDirection } from './steer.ts';

/**
 * Bounds of the catch-up multiplier on swim force, and its slope per tile of gap to the player.
 * Strong on purpose: a player who never kicks is about 1.8x slower than one who kicks well, and
 * the difficulty bar keeps both within reach of the rivals over a 90 s course. A rival ahead eases
 * off to hover a few seconds in front of a slow player; one behind a fast player pushes on but,
 * barely kicking, still loses a few seconds over the course.
 */
export const CATCH_UP = { perTile: 0.02, min: 0.35, max: 1.25 } as const;

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
  item: number;
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
  const draws: Draws = { wobble: rng.next(), kick: rng.next(), side: rng.next(), item: rng.next() };

  replanAim(world, racer, memory);
  stepWobble(memory, racer.profile.wobble, draws.wobble);
  const aim = wobbledAim(memory);
  const recovery = canRecover(world, racer, memory) ? recoveryMove(racer, memory, draws.side) : null;
  // A recovering rival is sliding off a wall, not racing, so it saves its kick and burst for the aim.
  const kick = recovery === null && wantsKick(racer, aim, draws.kick);
  const burst = recovery === null && wantsBurst(world, racer, aim, draws.item);
  return { move: recovery ?? aim, kick, burst };
}

/**
 * Stuck recovery runs only while racing and free to swim. A stunned or trapped rival sits still
 * through no fault of its steering, so that time resets its stuck count instead.
 */
function canRecover(world: World, racer: Racer, memory: AiMemory): boolean {
  if (world.race.phase !== 'racing') return false;
  if (racer.status.stunned > 0 || racer.status.trapped > 0) {
    memory.stuckTicks = 0;
    return false;
  }
  return true;
}

/**
 * Re-reads its field every `reactionTicks`, so slower rivals react later to the course. A rival
 * holding a Puffer that is inflated or ready to burst reads the smash field and aims through
 * coral, which its inflate breaks; while the burst cools down it steers around like everyone else.
 */
function replanAim(world: World, racer: Racer, memory: AiMemory): void {
  if (memory.replanIn <= 0) {
    const { fields, level, broken } = world;
    const smash = racer.stack.includes('puffer') && (racer.status.inflated > 0 || racer.burstCooldown === 0);
    const field = smash ? fields.smash : fields.steer;
    memory.aim = steerDirection(field, fields, level, broken, racer.body, LOOKAHEAD_TILES, smash);
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
  const c = cos(memory.wobble);
  const s = sin(memory.wobble);
  return { x: memory.aim.x * c - memory.aim.y * s, y: memory.aim.x * s + memory.aim.y * c };
}

/**
 * The sideways swim of a racer that has sat nearly still too long, held for RECOVER_TICKS to
 * slide off whatever it is pinned against; null while it isn't recovering.
 */
function recoveryMove(racer: Racer, memory: AiMemory, sideDraw: number): Vec | null {
  if (memory.recoverTicks === 0) {
    const speed = length(racer.body.vx, racer.body.vy);
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
  const speed = length(vx, vy);
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
