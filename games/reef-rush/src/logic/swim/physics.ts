/**
 * Swimming: how one racer's velocity responds to its intent and the water, the swim medium's
 * `applyIntent`. Velocity, facing and kick cooldown only; position is moved by `collide.ts`. The
 * numbers are the swim medium's tuning (`SWIM_TUNING`).
 */
import type { EventSink } from '@arcade/core';
import { kickImpulse } from '../abilities.ts';
import type { GameEvent } from '../events.ts';
import { SWIM_KICK_RULES, SWIM_TUNING } from '../media/swim/tuning.ts';
import type { Body, Environment, Intent, MoveModifiers, Racer, Vec } from '../types.ts';

const { force, drag, kick: kickSpeed, maxSpeed } = SWIM_TUNING;
const { sink, currentForce, kelpDragMul } = SWIM_TUNING.extra;

/**
 * Updates a racer's velocity, facing and kick cooldown for one tick.
 * Emits `racer.kicked` on the tick a kick fires.
 *
 * @param dt Tick length in seconds.
 */
export function applyIntent(
  racer: Racer,
  intent: Intent,
  env: Environment,
  mods: MoveModifiers,
  events: EventSink<GameEvent>,
  dt: number,
): void {
  const direction = unit(intent.move);
  const body = racer.body;
  updateFacing(racer, intent.move.x);

  accelerate(body, direction, force * mods.forceMul * dt);
  // A racer only sinks while idle; swimming in any direction holds depth, so cruise speed
  // scales exactly with forceMul.
  if (direction.x === 0 && direction.y === 0) accelerate(body, { x: 0, y: 1 }, sink * dt);
  if (env.current) accelerate(body, env.current, currentForce * dt);
  applyDrag(body, env, mods, dt);

  if (intent.kick && racer.kickCooldown === 0) kick(racer, direction, mods, events);
  else if (racer.kickCooldown > 0) racer.kickCooldown -= 1;

  capSpeed(body);
}

/** The vector scaled to length 1, or zero when it has no length. */
function unit(v: Vec): Vec {
  const length = Math.sqrt(v.x * v.x + v.y * v.y);
  return length === 0 ? { x: 0, y: 0 } : { x: v.x / length, y: v.y / length };
}

/** Faces the way the racer is steering horizontally; no horizontal input keeps the old facing. */
function updateFacing(racer: Racer, moveX: number): void {
  if (moveX > 0) racer.facing = 1;
  else if (moveX < 0) racer.facing = -1;
}

/** Adds `amount` px/s of velocity along a unit direction. */
function accelerate(body: Body, direction: Vec, amount: number): void {
  body.vx += direction.x * amount;
  body.vy += direction.y * amount;
}

function applyDrag(body: Body, env: Environment, mods: MoveModifiers, dt: number): void {
  const kelpMul = env.inKelp ? kelpDragMul : 1;
  // A long enough dt would make the factor negative and reverse the racer; drag only ever stops it.
  const keep = Math.max(0, 1 - drag * mods.dragMul * kelpMul * dt);
  body.vx *= keep;
  body.vy *= keep;
}

/**
 * Fires a kick along the input direction, or straight ahead along facing when there is no input,
 * shaped by the racer's ability (`kickImpulse`) under swim's kick rules.
 */
function kick(racer: Racer, direction: Vec, mods: MoveModifiers, events: EventSink<GameEvent>): void {
  const aim = direction.x === 0 && direction.y === 0 ? { x: racer.facing, y: 0 } : direction;
  accelerate(racer.body, kickImpulse(racer, aim, SWIM_KICK_RULES), kickSpeed * mods.kickMul);
  racer.kickCooldown = mods.kickCooldownTicks;
  events.emit({ type: 'racer.kicked', id: racer.id });
}

function capSpeed(body: Body): void {
  const speed = Math.sqrt(body.vx * body.vx + body.vy * body.vy);
  if (speed <= maxSpeed) return;
  const scale = maxSpeed / speed;
  body.vx *= scale;
  body.vy *= scale;
}
