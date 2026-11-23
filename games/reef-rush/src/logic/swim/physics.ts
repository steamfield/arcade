/**
 * Swimming: how one racer's velocity responds to its intent and the water.
 * Velocity, facing and kick cooldown only; position is moved by `collide.ts`.
 */
import type { EventSink } from '@arcade/core';
import { kickImpulse } from '../abilities.ts';
import type { GameEvent } from '../events.ts';
import type { Body, Environment, Intent, MoveModifiers, Racer, Vec } from '../types.ts';

/**
 * Swim tuning in pixels and seconds. Cruise speed is `force / drag`.
 * Values are shared by the player and rivals; profiles scale them through MoveModifiers.
 */
export const SWIM = {
  /** Acceleration from holding a direction, px/s². */
  force: 210,
  /** Linear drag per second; speed decays by `drag * dt` of itself each tick. */
  drag: 3,
  /** Downward acceleration while no direction is held, px/s². */
  sink: 14,
  /** Acceleration a current applies along its direction, px/s². */
  currentForce: 160,
  /** Drag multiplier inside kelp. */
  kelpDragMul: 2.2,
  /** Speed added by a kick, px/s. */
  kick: 110,
  /** Hard cap on speed, px/s. */
  maxSpeed: 180,
} as const;

/** Modifiers for a racer with no profile bonuses or power-ups. */
export const BASE_MODIFIERS: MoveModifiers = { forceMul: 1, kickMul: 1, kickCooldownTicks: 36, dragMul: 1 };

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

  accelerate(body, direction, SWIM.force * mods.forceMul * dt);
  // A racer only sinks while idle; swimming in any direction holds depth, so cruise speed
  // scales exactly with forceMul.
  if (direction.x === 0 && direction.y === 0) accelerate(body, { x: 0, y: 1 }, SWIM.sink * dt);
  if (env.current) accelerate(body, env.current, SWIM.currentForce * dt);
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
  const kelpMul = env.inKelp ? SWIM.kelpDragMul : 1;
  // A long enough dt would make the factor negative and reverse the racer; drag only ever stops it.
  const keep = Math.max(0, 1 - SWIM.drag * mods.dragMul * kelpMul * dt);
  body.vx *= keep;
  body.vy *= keep;
}

/**
 * Fires a kick along the input direction, or straight ahead along facing when there is no input,
 * shaped by the racer's ability (`kickImpulse`).
 */
function kick(racer: Racer, direction: Vec, mods: MoveModifiers, events: EventSink<GameEvent>): void {
  const aim = direction.x === 0 && direction.y === 0 ? { x: racer.facing, y: 0 } : direction;
  accelerate(racer.body, kickImpulse(racer, aim), SWIM.kick * mods.kickMul);
  racer.kickCooldown = mods.kickCooldownTicks;
  events.emit({ type: 'racer.kicked', id: racer.id });
}

function capSpeed(body: Body): void {
  const speed = Math.sqrt(body.vx * body.vx + body.vy * body.vy);
  if (speed <= SWIM.maxSpeed) return;
  const scale = SWIM.maxSpeed / speed;
  body.vx *= scale;
  body.vy *= scale;
}
