/**
 * Running and jumping: velocity, facing and the runner's own motion state for one tick, the run
 * medium's `applyIntent`. Position is moved by `race/move.ts`. Up (`move.y < -0.5`) jumps on a fresh
 * press and is held for height; the dash is in `dash.ts`. Wind (current cells) pushes a runner along
 * its direction and mud (kelp cells) lowers its top speed. A fallen runner is parked until
 * `afterRunMove` brings it back.
 */
import type { EventSink } from '@arcade/core';
import { jumpMulFor } from '../../abilities.ts';
import type { GameEvent } from '../../events.ts';
import type { Body, Intent, MoveModifiers, Racer } from '../../types.ts';
import type { MediumEnv, MediumTuning } from '../types.ts';
import { coolDownKick, dashOrCoolDown } from './dash.ts';
import { type RunEnv, type RunMotion, runEnv, runMotion } from './data.ts';

/** Up counts as held past this far up the stick. */
const UP_THRESHOLD = -0.5;

/** How much of forceMul's deviation from 1 reaches ground accel and top speed: 1.4 runs 20 % faster. */
const FORCE_SHARE = 0.5;

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
    parkedAt: { x: body.x, y: body.y },
  };
}

/**
 * One tick of run, jump, dash and gravity. A jump fires when a press is buffered and the runner is
 * grounded or inside coyote time, and emits `racer.jumped`; releasing Up while a jump rises
 * multiplies gravity. Horizontal speed never passes `tuning.maxSpeed`, however strong the
 * modifiers; vertical speed is capped only by `maxFall` on the way down. A fallen racer
 * (`status.fallen`) is held still with no gravity.
 *
 * @param dt Tick length in seconds.
 * @throws {Error} When the racer's motion or `env` isn't run's, or `tuning` lacks one of run's extras.
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
  const surroundings = runEnv(env);
  const extra = runExtra(tuning);
  if (racer.status.fallen > 0) {
    park(racer.body);
    coolDownKick(racer);
    return;
  }
  const upHeld = intent.move.y < UP_THRESHOLD;
  const pressed = upHeld && !motion.upWasHeld;
  motion.upWasHeld = upHeld;
  const jumpNow = jumpReady(motion, surroundings.grounded, pressed);
  advanceJumpTimers(motion, surroundings.grounded, pressed, extra);
  updateFacing(racer, intent.move.x);

  run(racer.body, intent.move.x, surroundings, tuning, extra, mods, dt);
  if (jumpNow) jump(racer, motion, extra.jumpSpeed * jumpMulFor(racer), events);
  dashOrCoolDown(racer, motion, intent.kick, surroundings.grounded, tuning, mods, events);
  racer.body.vx = clamp(racer.body.vx, -tuning.maxSpeed, tuning.maxSpeed);
  fall(racer.body, motion.jumping && !upHeld, surroundings, extra, dt);
}

/** The extras run reads from `tuning.extra`. */
const RUN_EXTRAS = [
  'runSpeed',
  'gravity',
  'cutGravityMul',
  'maxFall',
  'airAccel',
  'airFriction',
  'jumpSpeed',
  'coyoteTicks',
  'bufferTicks',
  'respawnTicks',
  'respawnInvulnTicks',
  'windSpeed',
  'draftForce',
  'mudSpeedMul',
] as const;

/** Run's extras from the tuning, by name. */
type RunExtra = Record<(typeof RUN_EXTRAS)[number], number>;

/**
 * Reads run's extras from `tuning`.
 *
 * @throws {Error} When an extra is missing, which means the tuning isn't run's.
 */
export function runExtra(tuning: MediumTuning): RunExtra {
  const entries = RUN_EXTRAS.map((key) => {
    const value = tuning.extra[key];
    if (value === undefined) throw new Error(`Run tuning has no extra '${key}'; pass run's tuning (effectiveTuning)`);
    return [key, value] as const;
  });
  return Object.fromEntries(entries) as RunExtra;
}

/**
 * How high, px, a jump from standing lifts a runner that holds Up for `holdTicks` ticks counting the
 * press, with no wind and `jumpMulFor` 1: `jumpSpeed` up, then each tick `fall` exactly as
 * `applyRunIntent` applies it, and the body moved by its new `vy`. Holding past the top of the jump
 * adds nothing.
 *
 * @param dt Tick length in seconds.
 * @throws {Error} When `tuning` lacks one of run's extras.
 */
export function jumpPeak(tuning: MediumTuning, holdTicks: number, dt: number): number {
  const extra = runExtra(tuning);
  const stillAir: RunEnv = { kind: 'run', grounded: false, wind: null, inMud: false };
  const body: Body = { x: 0, y: 0, w: 0, h: 0, vx: 0, vy: -extra.jumpSpeed };
  let peak = 0;
  for (let tick = 0; body.vy < 0; tick++) {
    fall(body, tick >= holdTicks, stillAir, extra, dt);
    body.y += body.vy * dt;
    peak = Math.max(peak, -body.y);
  }
  return peak;
}

/** Fallen racers wait out of sight: no velocity, so no gravity carries them further. */
function park(body: Body): void {
  body.vx = 0;
  body.vy = 0;
}

/**
 * True when a jump fires this tick: Up was pressed now or within the buffer, and the runner stands
 * or left the ground within coyote time.
 */
function jumpReady(motion: RunMotion, grounded: boolean, pressed: boolean): boolean {
  return (pressed || motion.buffer > 0) && (grounded || motion.coyote > 0);
}

/**
 * Counts the buffer and coyote time down a tick. A press stays live for `bufferTicks` ticks after
 * it, and standing keeps a jump available for `coyoteTicks` ticks after leaving the ground.
 */
function advanceJumpTimers(motion: RunMotion, grounded: boolean, pressed: boolean, extra: RunExtra): void {
  motion.buffer = pressed ? extra.bufferTicks : Math.max(0, motion.buffer - 1);
  motion.coyote = grounded ? extra.coyoteTicks : Math.max(0, motion.coyote - 1);
  if (grounded) motion.jumping = false;
}

/** Faces the way the runner is steering; no horizontal input keeps the old facing. */
function updateFacing(racer: Racer, moveX: number): void {
  if (moveX > 0) racer.facing = 1;
  else if (moveX < 0) racer.facing = -1;
}

/** Share of forceMul a runner feels: half its deviation from 1. */
function forceScale(mods: MoveModifiers): number {
  return 1 + (mods.forceMul - 1) * FORCE_SHARE;
}

/**
 * Moves `vx` toward the held direction's top speed plus any gust. Over that speed (after a dash or
 * a hit) the runner slows by friction instead of snapping back, and with nothing held it slows to
 * the gust's drift.
 */
function run(
  body: Body,
  wanted: number,
  env: RunEnv,
  tuning: MediumTuning,
  extra: RunExtra,
  mods: MoveModifiers,
  dt: number,
): void {
  const scale = forceScale(mods);
  const top = extra.runSpeed * scale * (env.inMud ? extra.mudSpeedMul : 1);
  const drift = (env.wind?.x ?? 0) * extra.windSpeed;
  const accel = (env.grounded ? tuning.force * scale : extra.airAccel) * dt;
  // dragMul scales air friction too, so ink or a power-up slows a runner the same in a jump.
  const friction = (env.grounded ? tuning.drag : extra.airFriction) * mods.dragMul * dt;
  if (wanted === 0) {
    body.vx = approach(body.vx, drift, friction);
    return;
  }
  const target = Math.sign(wanted) * top + drift;
  const overTarget = Math.sign(body.vx) === Math.sign(target) && Math.abs(body.vx) > Math.abs(target);
  body.vx = approach(body.vx, target, overTarget ? friction : accel);
}

function jump(racer: Racer, motion: RunMotion, speed: number, events: EventSink<GameEvent>): void {
  racer.body.vy = -speed;
  motion.buffer = 0;
  motion.coyote = 0;
  motion.jumping = true;
  events.emit({ type: 'racer.jumped', id: racer.id });
}

/**
 * Gravity, stronger while a jump rises with Up released (the short hop), plus any updraft or
 * downdraft. Only falling speed is capped, so a jump or a stomp bounce keeps its full rise.
 */
function fall(body: Body, cutShort: boolean, env: RunEnv, extra: RunExtra, dt: number): void {
  const draft = (env.wind?.y ?? 0) * extra.draftForce;
  body.vy = stepFallSpeed(body.vy, cutShort, draft, extra, dt);
}

/**
 * Vertical speed, px/s with down positive, after one tick of gravity: stronger while rising when
 * `cutShort` (Up released), plus `draft` (px/s², an updraft or downdraft), and capped at `maxFall`
 * only on the way down. The step `applyRunIntent` takes each tick, shared with the nav's jump arcs.
 *
 * @param dt Tick length in seconds.
 */
export function stepFallSpeed(
  speed: number,
  cutShort: boolean,
  draft: number,
  extra: { gravity: number; cutGravityMul: number; maxFall: number },
  dt: number,
): number {
  const cut = cutShort && speed < 0 ? extra.cutGravityMul : 1;
  return Math.min(extra.maxFall, speed + (extra.gravity * cut + draft) * dt);
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function approach(value: number, target: number, step: number): number {
  if (value < target) return Math.min(target, value + step);
  return Math.max(target, value - step);
}
