/**
 * Swimming: how one racer's velocity responds to its intent and the water, the swim medium's
 * `applyIntent`. Velocity, facing and kick cooldown only; position is moved by `race/move.ts`. Every
 * number comes from the tuning it is handed: swim's (`SWIM_TUNING`) with the course's overrides.
 */
import type { EventSink } from '@arcade/core';
import { kickImpulse } from '../../abilities.ts';
import type { GameEvent } from '../../events.ts';
import type { Body, Intent, MoveModifiers, Racer, Vec } from '../../types.ts';
import type { MediumEnv, MediumTuning } from '../types.ts';
import { type SwimEnv, swimEnv } from './data.ts';
import { SWIM_KICK_RULES } from './tuning.ts';

/** The swim extras `applyIntent` reads from `tuning.extra`. */
const SWIM_EXTRAS = ['sink', 'currentForce', 'kelpDragMul'] as const;
type SwimExtras = Record<(typeof SWIM_EXTRAS)[number], number>;

/**
 * Swim's extras from `tuning`.
 *
 * @throws {Error} When `tuning.extra` lacks one, which means the tuning isn't swim's.
 */
function swimExtras(tuning: MediumTuning): SwimExtras {
  const read = (key: (typeof SWIM_EXTRAS)[number]): number => {
    const value = tuning.extra[key];
    if (value === undefined) throw new Error(`Swim tuning has no extra '${key}'; pass swim's tuning (effectiveTuning)`);
    return value;
  };
  return { sink: read('sink'), currentForce: read('currentForce'), kelpDragMul: read('kelpDragMul') };
}

/**
 * Updates a racer's velocity, facing and kick cooldown for one tick.
 * Emits `racer.kicked` on the tick a kick fires.
 *
 * @param tuning Swim's tuning with the course's overrides (`effectiveTuning`).
 * @param dt Tick length in seconds.
 * @throws {Error} When `tuning.extra` lacks one of swim's extras, or `env` isn't swim's (`swimEnv`).
 */
export function applyIntent(
  racer: Racer,
  intent: Intent,
  env: MediumEnv,
  tuning: MediumTuning,
  mods: MoveModifiers,
  events: EventSink<GameEvent>,
  dt: number,
): void {
  const { sink, currentForce } = swimExtras(tuning);
  const water = swimEnv(env);
  const direction = unit(intent.move);
  const body = racer.body;
  updateFacing(racer, intent.move.x);

  accelerate(body, direction, tuning.force * mods.forceMul * dt);
  // A racer only sinks while idle; swimming in any direction holds depth, so cruise speed
  // scales exactly with forceMul.
  if (direction.x === 0 && direction.y === 0) accelerate(body, { x: 0, y: 1 }, sink * dt);
  if (water.current) accelerate(body, water.current, currentForce * dt);
  applyDrag(body, water, tuning, mods, dt);

  if (intent.kick && racer.kickCooldown === 0) kick(racer, direction, tuning.kick * mods.kickMul, mods, events);
  else if (racer.kickCooldown > 0) racer.kickCooldown -= 1;

  capSpeed(body, tuning.maxSpeed);
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

function applyDrag(body: Body, env: SwimEnv, tuning: MediumTuning, mods: MoveModifiers, dt: number): void {
  const kelpMul = env.inKelp ? swimExtras(tuning).kelpDragMul : 1;
  // A long enough dt would make the factor negative and reverse the racer; drag only ever stops it.
  const keep = Math.max(0, 1 - tuning.drag * mods.dragMul * kelpMul * dt);
  body.vx *= keep;
  body.vy *= keep;
}

/**
 * Fires a kick along the input direction, or straight ahead along facing when there is no input,
 * shaped by the racer's ability (`kickImpulse`) under swim's kick rules, adding `speed` px/s.
 */
function kick(racer: Racer, direction: Vec, speed: number, mods: MoveModifiers, events: EventSink<GameEvent>): void {
  const aim = direction.x === 0 && direction.y === 0 ? { x: racer.facing, y: 0 } : direction;
  accelerate(racer.body, kickImpulse(racer, aim, SWIM_KICK_RULES), speed);
  racer.kickCooldown = mods.kickCooldownTicks;
  events.emit({ type: 'racer.kicked', id: racer.id });
}

function capSpeed(body: Body, maxSpeed: number): void {
  const speed = Math.sqrt(body.vx * body.vx + body.vy * body.vy);
  if (speed <= maxSpeed) return;
  const scale = maxSpeed / speed;
  body.vx *= scale;
  body.vy *= scale;
}
