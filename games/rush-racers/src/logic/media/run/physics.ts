/**
 * Running and jumping: velocity, facing and the runner's own motion state for one tick. Position is
 * moved by `race/move.ts`. Up (`move.y < -0.5`) jumps on a fresh press and is held for height.
 *
 * Scaffold baseline ported from the ground spike: run, jump with coyote time and a buffer, the
 * short-hop cut and gravity. Phase 2 lane a adds the dash, every MoveModifiers field and Gil's
 * higher jump, and owns this file.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from '../../events.ts';
import type { Body, Intent, MoveModifiers, Racer } from '../../types.ts';
import type { MediumEnv, MediumTuning } from '../types.ts';
import { type RunMotion, runEnv, runMotion } from './data.ts';

/** Up counts as held past this far up the stick. */
const UP_THRESHOLD = -0.5;

/** Fresh motion state for a runner at its start. */
export function createRunMotion(body: Body): RunMotion {
  return {
    kind: 'run',
    grounded: false,
    coyote: 0,
    buffer: 0,
    upWasHeld: false,
    jumping: false,
    airDashUsed: false,
    lastSafe: { x: body.x, y: body.y },
  };
}

/**
 * One tick of run, jump and gravity. A jump fires when a press is buffered and the runner is grounded
 * or inside coyote time, and emits `racer.jumped`; releasing Up while rising multiplies gravity.
 *
 * @throws {Error} When the racer's motion or `env` isn't run's.
 */
export function applyRunIntent(
  racer: Racer,
  intent: Intent,
  env: MediumEnv,
  tuning: MediumTuning,
  mods: MoveModifiers,
  events: EventSink<GameEvent>,
  dt: number,
): void {
  const motion = runMotion(racer.motion);
  const { grounded } = runEnv(env);
  const extra = runExtra(tuning);
  const upHeld = intent.move.y < UP_THRESHOLD;
  const pressed = upHeld && !motion.upWasHeld;
  motion.upWasHeld = upHeld;

  if (grounded) {
    motion.coyote = extra.coyoteTicks;
    motion.jumping = false;
  } else if (motion.coyote > 0) motion.coyote -= 1;
  motion.buffer = pressed ? extra.bufferTicks : Math.max(0, motion.buffer - 1);
  if (intent.move.x > 0) racer.facing = 1;
  else if (intent.move.x < 0) racer.facing = -1;

  run(racer.body, intent.move.x, grounded, tuning, mods, dt);
  if (motion.buffer > 0 && motion.coyote > 0) jump(racer, motion, extra.jumpSpeed, events);
  fall(racer.body, upHeld, extra, dt);
}

/** Run's extras from the tuning, by name. */
type RunExtra = Record<
  'gravity' | 'cutGravityMul' | 'maxFall' | 'airAccel' | 'airFriction' | 'jumpSpeed' | 'coyoteTicks' | 'bufferTicks',
  number
>;

/**
 * Reads run's extras from `tuning`.
 *
 * @throws {Error} When an extra is missing, which means the tuning isn't run's.
 */
export function runExtra(tuning: MediumTuning): RunExtra {
  const read = (key: keyof RunExtra): number => {
    const value = tuning.extra[key];
    if (value === undefined) throw new Error(`Run tuning has no extra '${key}'; pass run's tuning (effectiveTuning)`);
    return value;
  };
  return {
    gravity: read('gravity'),
    cutGravityMul: read('cutGravityMul'),
    maxFall: read('maxFall'),
    airAccel: read('airAccel'),
    airFriction: read('airFriction'),
    jumpSpeed: read('jumpSpeed'),
    coyoteTicks: read('coyoteTicks'),
    bufferTicks: read('bufferTicks'),
  };
}

function run(
  body: Body,
  wanted: number,
  grounded: boolean,
  tuning: MediumTuning,
  mods: MoveModifiers,
  dt: number,
): void {
  const extra = runExtra(tuning);
  const top = tuning.maxSpeed;
  const accel = (grounded ? tuning.force : extra.airAccel) * dt;
  const friction = (grounded ? tuning.drag : extra.airFriction) * mods.dragMul * dt;
  if (wanted === 0) body.vx = approach(body.vx, 0, friction);
  else if (Math.abs(body.vx) > top && Math.sign(body.vx) === Math.sign(wanted))
    body.vx = approach(body.vx, wanted * top, friction);
  else body.vx = approach(body.vx, Math.sign(wanted) * top, accel);
}

function jump(racer: Racer, motion: RunMotion, speed: number, events: EventSink<GameEvent>): void {
  racer.body.vy = -speed;
  motion.buffer = 0;
  motion.coyote = 0;
  motion.jumping = true;
  events.emit({ type: 'racer.jumped', id: racer.id });
}

function fall(body: Body, upHeld: boolean, extra: RunExtra, dt: number): void {
  const cut = body.vy < 0 && !upHeld ? extra.cutGravityMul : 1;
  body.vy = Math.min(extra.maxFall, body.vy + extra.gravity * cut * dt);
}

function approach(value: number, target: number, step: number): number {
  if (value < target) return Math.min(target, value + step);
  return Math.max(target, value - step);
}
