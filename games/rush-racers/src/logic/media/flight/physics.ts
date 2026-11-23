/**
 * Flying: velocity, facing and the flyer's own motion state for one tick, the flight medium's
 * `applyIntent`. Position is moved by `race/move.ts`. Gravity always pulls; a fresh Up press
 * (`move.y < -0.5`) flaps, Up held caps the fall (a glide), Down held dives, and letting go of Down
 * carries the dive into forward speed. Left and right steer toward a cruise speed with momentum. The
 * dash is a forward burst that pops puff clouds for a few ticks (`flightRamsCoral`). Wind cells push
 * along their arrow and fog lowers cruise.
 *
 * Scaffold baseline: phase 1 lane a replaces the body of this file behind the same exports.
 */
import type { EventSink } from '@arcade/core';
import { jumpMulFor } from '../../abilities.ts';
import type { GameEvent } from '../../events.ts';
import type { Body, Intent, MoveModifiers, Racer } from '../../types.ts';
import type { MediumEnv, MediumTuning } from '../types.ts';
import { type FlightEnv, type FlightMotion, flightEnv, flightMotion } from './data.ts';

/** Up counts as held past this far up the stick. */
const UP_THRESHOLD = -0.5;
/** Down counts as held past this far down the stick. */
const DOWN_THRESHOLD = 0.5;
/** How much of forceMul's deviation from 1 reaches horizontal acceleration and cruise: 1.4 flies 20 % faster. */
const FORCE_SHARE = 0.5;

/** Fresh motion state for a flyer at its start. */
export function createFlightMotion(_body: Body): FlightMotion {
  return { kind: 'flight', upWasHeld: false, flapCooldown: 0, diving: false, dashWindow: 0 };
}

/**
 * One tick of flight. A flap fires on a fresh Up press with the flap cooldown run out, sets
 * `vy` to at most `-flapLift * jumpMulFor(racer)` and emits `racer.flapped` (never `racer.kicked`,
 * so it spends no dash charge). The dash sets `vx` to `kick * kickMul` along facing, leaves `vy`,
 * opens the puff-popping window and emits `racer.kicked`. Horizontal speed never passes
 * `tuning.maxSpeed`. A fallen racer (`status.fallen`) is held still with no gravity.
 *
 * @param dt Tick length in seconds.
 * @throws {Error} When the racer's motion or `env` isn't flight's, or `tuning` lacks one of flight's extras.
 */
export function applyFlightIntent(
  racer: Racer,
  intent: Intent,
  env: MediumEnv,
  tuning: MediumTuning,
  mods: MoveModifiers,
  events: EventSink<GameEvent>,
  dt: number,
): void {
  const motion = flightMotion(racer.motion);
  const air = flightEnv(env);
  const extra = flightExtra(tuning);
  const { body } = racer;
  if (motion.flapCooldown > 0) motion.flapCooldown -= 1;
  if (motion.dashWindow > 0) motion.dashWindow -= 1;
  if (racer.status.fallen > 0) {
    body.vx = 0;
    body.vy = 0;
    motion.dashWindow = 0;
    coolDownKick(racer);
    return;
  }
  const upHeld = intent.move.y < UP_THRESHOLD;
  const downHeld = intent.move.y > DOWN_THRESHOLD;
  const pressed = upHeld && !motion.upWasHeld;
  motion.upWasHeld = upHeld;
  const carry = motion.diving && !downHeld ? Math.max(0, body.vy) * extra.diveCarry : 0;
  motion.diving = downHeld;
  updateFacing(racer, intent.move.x);

  cruise(body, intent.move.x, air, tuning, extra, mods, dt);
  body.vx += racer.facing * carry;
  fall(body, upHeld, downHeld, air, extra, dt);
  if (pressed && motion.flapCooldown === 0) flap(racer, motion, extra, events);
  dashOrCoolDown(racer, motion, intent.kick, tuning, extra, mods, events);
  body.vx = Math.min(tuning.maxSpeed, Math.max(-tuning.maxSpeed, body.vx));
}

/** True while the racer's last dash still pops puff clouds it touches: flight's `ramsCoral`. */
export function flightRamsCoral(racer: Racer): boolean {
  return flightMotion(racer.motion).dashWindow > 0;
}

/** The extras flight reads from `tuning.extra`. */
const FLIGHT_EXTRAS = [
  'cruise',
  'gravity',
  'maxFall',
  'flapLift',
  'flapCooldownTicks',
  'glideFall',
  'diveAccel',
  'diveMaxFall',
  'diveCarry',
  'dashTicks',
  'respawnTicks',
  'respawnInvulnTicks',
  'windSpeed',
  'draftForce',
  'fogCruiseMul',
] as const;

/** Flight's extras from the tuning, by name. */
export type FlightExtra = Record<(typeof FLIGHT_EXTRAS)[number], number>;

/**
 * Reads flight's extras from `tuning`.
 *
 * @throws {Error} When an extra is missing, which means the tuning isn't flight's.
 */
export function flightExtra(tuning: MediumTuning): FlightExtra {
  const entries = FLIGHT_EXTRAS.map((key) => {
    const value = tuning.extra[key];
    if (value === undefined) {
      throw new Error(`Flight tuning has no extra '${key}'; pass flight's tuning (effectiveTuning)`);
    }
    return [key, value] as const;
  });
  return Object.fromEntries(entries) as FlightExtra;
}

/** Faces the way the flyer is steering; no horizontal input keeps the old facing. */
function updateFacing(racer: Racer, moveX: number): void {
  if (moveX > 0) racer.facing = 1;
  else if (moveX < 0) racer.facing = -1;
}

/**
 * Moves `vx` toward cruise (plus any gust) in the held direction at `force`. Over that speed while
 * still steering that way, the surplus bleeds at `drag`; with no stick, the flyer coasts down to the
 * gust's drift at `drag`.
 */
function cruise(
  body: Body,
  wanted: number,
  air: FlightEnv,
  tuning: MediumTuning,
  extra: FlightExtra,
  mods: MoveModifiers,
  dt: number,
): void {
  const scale = 1 + (mods.forceMul - 1) * FORCE_SHARE;
  const top = extra.cruise * scale * (air.inFog ? extra.fogCruiseMul : 1);
  const drift = (air.wind?.x ?? 0) * extra.windSpeed;
  const friction = tuning.drag * mods.dragMul * dt;
  if (wanted === 0) {
    body.vx = approach(body.vx, drift, friction);
    return;
  }
  const target = Math.sign(wanted) * top + drift;
  const over = Math.sign(body.vx) === Math.sign(target) && Math.abs(body.vx) > Math.abs(target);
  if (over) body.vx = Math.sign(body.vx) * Math.max(Math.abs(body.vx) - friction, Math.abs(target));
  else body.vx = approach(body.vx, target, tuning.force * scale * dt);
}

/**
 * Gravity, or the dive's pull while Down is held, plus any updraft or downdraft, with the fall
 * capped at `diveMaxFall` diving, `glideFall` with Up held and `maxFall` otherwise.
 */
function fall(body: Body, upHeld: boolean, downHeld: boolean, air: FlightEnv, extra: FlightExtra, dt: number): void {
  const draft = (air.wind?.y ?? 0) * extra.draftForce;
  const pull = downHeld ? extra.diveAccel : extra.gravity;
  const cap = downHeld ? extra.diveMaxFall : upHeld ? extra.glideFall : extra.maxFall;
  body.vy = Math.min(cap, body.vy + (pull + draft) * dt);
}

function flap(racer: Racer, motion: FlightMotion, extra: FlightExtra, events: EventSink<GameEvent>): void {
  racer.body.vy = Math.min(racer.body.vy, -extra.flapLift * jumpMulFor(racer));
  motion.flapCooldown = extra.flapCooldownTicks;
  events.emit({ type: 'racer.flapped', id: racer.id });
}

/** Dashes when the button is pressed and the dash is ready; otherwise runs the cooldown down a tick. */
function dashOrCoolDown(
  racer: Racer,
  motion: FlightMotion,
  kick: boolean,
  tuning: MediumTuning,
  extra: FlightExtra,
  mods: MoveModifiers,
  events: EventSink<GameEvent>,
): void {
  if (kick && racer.kickCooldown === 0) {
    racer.body.vx = racer.facing * tuning.kick * mods.kickMul;
    motion.dashWindow = extra.dashTicks;
    racer.kickCooldown = mods.kickCooldownTicks;
    events.emit({ type: 'racer.kicked', id: racer.id });
    return;
  }
  coolDownKick(racer);
}

/** Takes a tick off the kick cooldown, stopping at 0. */
function coolDownKick(racer: Racer): void {
  if (racer.kickCooldown > 0) racer.kickCooldown -= 1;
}

function approach(value: number, target: number, step: number): number {
  if (value < target) return Math.min(target, value + step);
  return Math.max(target, value - step);
}
