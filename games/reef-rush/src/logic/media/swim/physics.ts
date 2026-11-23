/**
 * Swimming: how one racer's velocity responds to its intent and the water, or the air above a
 * surface, the swim medium's `applyIntent`. Velocity, facing, kick cooldown and the airborne flag
 * only; position is moved by `race/collide.ts`. Every number comes from the tuning it is handed:
 * swim's (`SWIM_TUNING`) with the course's overrides.
 */
import type { EventSink } from '@arcade/core';
import { kickImpulse } from '../../abilities.ts';
import type { GameEvent } from '../../events.ts';
import type { Body, Intent, MoveModifiers, Racer, Vec } from '../../types.ts';
import type { MediumEnv, MediumTuning } from '../types.ts';
import { type SwimEnv, swimEnv, swimMotion } from './data.ts';
import { SWIM_KICK_RULES } from './tuning.ts';

/** The swim extras `applyIntent` reads from `tuning.extra`. */
const SWIM_EXTRAS = ['sink', 'currentForce', 'kelpDragMul', 'airGravity', 'airDrag', 'airSteer'] as const;
type SwimExtra = (typeof SWIM_EXTRAS)[number];
type SwimExtras = Record<SwimExtra, number>;

const DOWN: Vec = { x: 0, y: 1 };

/**
 * Swim's extras from `tuning`.
 *
 * @throws {Error} When `tuning.extra` lacks one, which means the tuning isn't swim's.
 */
function swimExtras(tuning: MediumTuning): SwimExtras {
  const read = (key: SwimExtra): [SwimExtra, number] => {
    const value = tuning.extra[key];
    if (value === undefined) throw new Error(`Swim tuning has no extra '${key}'; pass swim's tuning (effectiveTuning)`);
    return [key, value];
  };
  return Object.fromEntries(SWIM_EXTRAS.map(read)) as SwimExtras;
}

/**
 * Updates a racer's velocity, facing and kick cooldown for one tick: swimming in water, or an arc
 * under gravity in the air above a surface, where the stick only nudges and a kick doesn't fire.
 * Emits `racer.kicked` on the tick a kick fires, `racer.breached` on the first tick its environment
 * reads air after water, and `racer.splashed` on the first tick it reads water after air.
 *
 * @param tuning Swim's tuning with the course's overrides (`effectiveTuning`).
 * @param dt Tick length in seconds.
 * @throws {Error} When `tuning.extra` lacks one of swim's extras, or `env` or the racer's motion
 *   isn't swim's (`swimEnv`, `swimMotion`).
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
  const extras = swimExtras(tuning);
  const surroundings = swimEnv(env);
  noteSurfaceCrossing(racer, surroundings, events);
  const direction = unit(intent.move);
  updateFacing(racer, intent.move.x);

  if (surroundings.inAir) fly(racer.body, direction, tuning, extras, mods, dt);
  else swim(racer.body, direction, surroundings, tuning, extras, mods, dt);

  // There is nothing to push off in the air, so a kick only fires underwater.
  const kicks = intent.kick && racer.kickCooldown === 0 && !surroundings.inAir;
  if (kicks) kick(racer, direction, tuning.kick * mods.kickMul, mods, events);
  else if (racer.kickCooldown > 0) racer.kickCooldown -= 1;

  capSpeed(racer.body, tuning.maxSpeed);
}

/**
 * Records whether the racer is airborne, emitting `racer.breached` or `racer.splashed` when that
 * changes. It becomes airborne when its centre is in air, and stays so until its centre is
 * SPLASH_DEPTH below the surface (`nearSurface` false), so bobbing on the surface doesn't flicker.
 */
function noteSurfaceCrossing(racer: Racer, env: SwimEnv, events: EventSink<GameEvent>): void {
  const motion = swimMotion(racer.motion);
  const airborne = env.inAir || (motion.airborne && env.nearSurface);
  if (motion.airborne === airborne) return;
  motion.airborne = airborne;
  events.emit({ type: airborne ? 'racer.breached' : 'racer.splashed', id: racer.id });
}

/** One tick underwater: the stick's force, an idle sink, the current, and drag (more of it in kelp). */
function swim(
  body: Body,
  direction: Vec,
  water: SwimEnv,
  tuning: MediumTuning,
  extras: SwimExtras,
  mods: MoveModifiers,
  dt: number,
): void {
  accelerate(body, direction, tuning.force * mods.forceMul * dt);
  // A racer only sinks while idle; swimming in any direction holds depth, so cruise speed
  // scales exactly with forceMul.
  if (direction.x === 0 && direction.y === 0) accelerate(body, DOWN, extras.sink * dt);
  if (water.current) accelerate(body, water.current, extras.currentForce * dt);
  const kelpMul = water.inKelp ? extras.kelpDragMul : 1;
  applyDrag(body, tuning.drag * mods.dragMul * kelpMul, dt);
}

/** One tick in the air: gravity, `airSteer` of the stick's swim force, and the air's light drag. */
function fly(
  body: Body,
  direction: Vec,
  tuning: MediumTuning,
  extras: SwimExtras,
  mods: MoveModifiers,
  dt: number,
): void {
  accelerate(body, direction, tuning.force * mods.forceMul * extras.airSteer * dt);
  accelerate(body, DOWN, extras.airGravity * dt);
  applyDrag(body, extras.airDrag, dt);
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

/** Takes `drag` per second off the body's velocity. */
function applyDrag(body: Body, drag: number, dt: number): void {
  // A long enough dt would make the factor negative and reverse the racer; drag only ever stops it.
  const keep = Math.max(0, 1 - drag * dt);
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
