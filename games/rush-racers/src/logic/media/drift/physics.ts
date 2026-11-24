/**
 * Drifting: how one racer's velocity responds to its intent and its surroundings, the drift
 * medium's `applyIntent`. Velocity, facing and kick cooldown only; position is moved by
 * `race/move.ts`. Every number comes from the tuning it is handed, extras through `driftExtras`.
 */
import type { EventSink } from '@arcade/core';
import { kickImpulse } from '../../abilities.ts';
import type { GameEvent } from '../../events.ts';
import { length } from '../../num.ts';
import type { Body, Intent, MoveModifiers, Racer, Vec } from '../../types.ts';
import type { MediumEnv, MediumTuning } from '../types.ts';
import { type DriftEnv, type DriftMotion, driftEnv } from './data.ts';
import { DRIFT_KICK_RULES, type DriftExtras, driftCruise, driftExtras } from './tuning.ts';

/** A drifter's movement state at the start line: its start is its first free spot. */
export function createDriftMotion(body: Body): DriftMotion {
  return { kind: 'drift', parkedAt: { x: body.x, y: body.y }, lastFree: { x: body.x, y: body.y } };
}

/**
 * Updates a racer's velocity, facing and kick cooldown for one tick, in this order: facing from the
 * stick, thrust (never adding speed past the larger of the speed before it and the racer's cruise),
 * solar wind and the gravity wells' pull, drag, the dash, and the cap at `maxSpeed`. A racer that
 * is out of play feels neither wind nor pull, and a trapped one feels no pull. Emits `racer.kicked`
 * on the tick a dash fires.
 *
 * @param tuning Drift's tuning with the course's overrides (`effectiveTuning`).
 * @param dt Tick length in seconds.
 * @throws {Error} When `tuning.extra` lacks one of drift's extras, or `env` isn't drift's.
 */
export function applyDriftIntent(
  racer: Racer,
  intent: Intent,
  env: MediumEnv,
  tuning: MediumTuning,
  mods: MoveModifiers,
  events: EventSink<GameEvent>,
  dt: number,
): void {
  const extras = driftExtras(tuning);
  const surroundings = driftEnv(env);
  const { body } = racer;
  const stick = unitStick(intent.move);
  const cruise = driftCruise(extras, mods.forceMul, surroundings.inDust);
  if (intent.move.x !== 0) racer.facing = intent.move.x > 0 ? 1 : -1;
  thrust(body, stick, tuning.force * mods.forceMul * dt, cruise);
  if (racer.status.fallen === 0) blow(body, surroundings, extras.windForce * dt);
  if (feelsPull(racer)) fall(body, surroundings.pull, dt);
  slow(body, dragLoss(body, { extras, tuning, mods, env: surroundings, stick, cruise }, dt));
  dashOrCool(racer, intent.kick, stick, tuning.kick * mods.kickMul, mods, events);
  capSpeed(body, tuning.maxSpeed);
}

/** The stick as a unit vector, or zero when it is idle. */
function unitStick(move: Vec): Vec {
  const size = length(move.x, move.y);
  return size === 0 ? { x: 0, y: 0 } : { x: move.x / size, y: move.y / size };
}

/**
 * Adds `amount` px/s along `stick`, then scales the velocity back to the larger of the speed
 * before and `cruise` if it ended above that, so a burn can turn or slow a fast racer but never
 * add to its speed past cruise.
 */
function thrust(body: Body, stick: Vec, amount: number, cruise: number): void {
  const limit = Math.max(length(body.vx, body.vy), cruise);
  body.vx += stick.x * amount;
  body.vy += stick.y * amount;
  const speed = length(body.vx, body.vy);
  if (speed <= limit) return;
  body.vx *= limit / speed;
  body.vy *= limit / speed;
}

/** Pushes the body along the solar wind it is in; `amount` is one tick of a full-strength push. */
function blow(body: Body, env: DriftEnv, amount: number): void {
  if (!env.wind) return;
  body.vx += env.wind.x * amount;
  body.vy += env.wind.y * amount;
}

/** True when the wells pull on the racer: it is in play and not held in a bubble. */
function feelsPull(racer: Racer): boolean {
  return racer.status.fallen === 0 && racer.status.trapped === 0;
}

/** Accelerates the body by `pull`, px/s², for `dt` seconds; unlike thrust it can carry the racer past cruise (drag and `maxSpeed` still apply). */
function fall(body: Body, pull: Vec, dt: number): void {
  body.vx += pull.x * dt;
  body.vy += pull.y * dt;
}

/** What drag reads besides the body: the numbers, the racer's modifiers and where it is. */
interface DragInputs {
  extras: DriftExtras;
  tuning: MediumTuning;
  mods: MoveModifiers;
  env: DriftEnv;
  stick: Vec;
  cruise: number;
}

/**
 * The speed, px/s, drag takes off this tick, scaled by dragMul: thin dust, the idle brake, nebula
 * dust and `overDrag`. In nebula dust, thrust from rest or along the motion loses at most
 * `dustThrustShare` of its push below dust cruise. Counter-thrust keeps full drag for braking.
 */
function dragLoss(body: Body, inputs: DragInputs, dt: number): number {
  const { extras, tuning, mods, env, stick, cruise } = inputs;
  const burning = stick.x !== 0 || stick.y !== 0;
  const idle = burning ? 0 : extras.idleBrake;
  const dust = env.inDust ? extras.dustDrag : 0;
  const steady = (tuning.drag + idle + dust) * mods.dragMul * dt;
  const overCruise = Math.max(0, length(body.vx, body.vy) - cruise);
  const loss = steady + Math.min(extras.overDrag * mods.dragMul * dt, overCruise);
  if (!env.inDust || !burning || stick.x * body.vx + stick.y * body.vy < 0) return loss;
  const thrustBudget = tuning.force * mods.forceMul * dt * extras.dustThrustShare;
  return Math.min(loss, overCruise + thrustBudget);
}

/** Takes `amount` px/s off the body's speed along its velocity, stopping at rest. */
function slow(body: Body, amount: number): void {
  const speed = length(body.vx, body.vy);
  if (speed === 0) return;
  const keep = Math.max(0, speed - amount) / speed;
  body.vx *= keep;
  body.vy *= keep;
}

/**
 * Fires a dash of `strength` px/s along the stick (along facing with no stick) when one is asked
 * for and the cooldown is spent, or counts the cooldown down otherwise.
 */
function dashOrCool(
  racer: Racer,
  wantsDash: boolean,
  stick: Vec,
  strength: number,
  mods: MoveModifiers,
  events: EventSink<GameEvent>,
): void {
  if (!wantsDash || racer.kickCooldown > 0) {
    if (racer.kickCooldown > 0) racer.kickCooldown -= 1;
    return;
  }
  const aim = stick.x === 0 && stick.y === 0 ? { x: racer.facing, y: 0 } : stick;
  const impulse = kickImpulse(racer, aim, DRIFT_KICK_RULES);
  racer.body.vx += impulse.x * strength;
  racer.body.vy += impulse.y * strength;
  racer.kickCooldown = mods.kickCooldownTicks;
  events.emit({ type: 'racer.kicked', id: racer.id });
}

/** Scales the velocity down to `maxSpeed` when it is faster. */
function capSpeed(body: Body, maxSpeed: number): void {
  const speed = length(body.vx, body.vy);
  if (speed <= maxSpeed) return;
  body.vx *= maxSpeed / speed;
  body.vy *= maxSpeed / speed;
}
