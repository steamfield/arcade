/**
 * Glide, a test-only medium for the conformance suite: thrust along the stick against gravity that
 * never lets up, linear drag, a speed cap and a kick on a cooldown. Its navigation (`glide-nav.ts`)
 * and pilot (`glide-pilot.ts`) are its own, and it answers every rule generic code reads from a medium
 * differently from swim (ghost racers, horizontal-only dashes, falling trapped racers and loose
 * power-ups, no kick counters), so tests can see those rules go through the medium. Register it
 * with `registerMedium` before racing a course that names it; the game never does.
 */
import type { EventSink } from '@arcade/core';
import { kickImpulse } from '../abilities.ts';
import type { GameEvent } from '../events.ts';
import type { KickRules, Medium, MediumEffects, MediumEnv, MediumTuning } from '../media/types.ts';
import { length } from '../num.ts';
import type { Body, Intent, MoveModifiers, Racer, Vec } from '../types.ts';
import type { GlideEnv, GlideMotion } from './glide-data.ts';
import {
  buildGlideNav,
  glideAimFrom,
  glideCost,
  glideDistanceAt,
  glideNextTile,
  validateGlideLevel,
} from './glide-nav.ts';
import { createGlidePilot, steerGlider } from './glide-pilot.ts';

/** Glide's numbers in pixels and seconds; `extra.gravity` is the downward pull, px/s², held or not. */
export const GLIDE_TUNING = {
  base: { forceMul: 1, kickMul: 1, kickCooldownTicks: 30, dragMul: 1 },
  force: 240,
  drag: 2,
  maxSpeed: 150,
  kick: 90,
  extra: { gravity: 40 },
} as const satisfies MediumTuning;

/** Gravity keeps the vertical speed through a dash or knockback; trapped racers and loose power-ups fall. */
export const GLIDE_EFFECTS: MediumEffects = {
  dashAxes: 'horizontal',
  trappedDrift: 20,
  looseDrift: 15,
  stompBounce: null,
  solidClams: false,
  pitBelow: false,
  allowsLedges: false,
  assistAxes: 'both',
  gravityWells: false,
};

/** No kick counter works in the air; Gil's spring kick needs a kick aimed straight up. */
export const GLIDE_KICK_RULES: KickRules = {
  dodgesSquid: false,
  shakesLatch: false,
  countersUndertow: false,
  springKick: (aim) => aim.x === 0 && aim.y < 0,
};

/** Air has no currents or kelp. */
const STILL_AIR: GlideEnv = { kind: 'glide' };

/**
 * Velocity, facing and kick cooldown for one tick: thrust along the stick, gravity, drag, then a
 * kick along the stick (or the facing) when it is ready, then the speed cap.
 */
function applyGlide(
  racer: Racer,
  intent: Intent,
  _env: MediumEnv,
  tuning: MediumTuning,
  mods: MoveModifiers,
  events: EventSink<GameEvent>,
  dt: number,
): void {
  const { body } = racer;
  const direction = unit(intent.move);
  if (intent.move.x !== 0) racer.facing = intent.move.x > 0 ? 1 : -1;
  accelerate(body, direction, tuning.force * mods.forceMul * dt);
  body.vy += gravityOf(tuning) * dt;
  const keep = Math.max(0, 1 - tuning.drag * mods.dragMul * dt);
  body.vx *= keep;
  body.vy *= keep;
  if (intent.kick && racer.kickCooldown === 0) kick(racer, direction, tuning.kick * mods.kickMul, mods, events);
  else if (racer.kickCooldown > 0) racer.kickCooldown -= 1;
  capSpeed(body, tuning.maxSpeed);
}

/**
 * Glide's gravity from `tuning.extra`.
 *
 * @throws {Error} When the tuning has no gravity, which means it isn't glide's.
 */
function gravityOf(tuning: MediumTuning): number {
  const gravity = tuning.extra.gravity;
  if (gravity === undefined)
    throw new Error("Glide tuning has no extra 'gravity'; pass glide's tuning (effectiveTuning)");
  return gravity;
}

function unit(v: Vec): Vec {
  const size = length(v.x, v.y);
  return size === 0 ? { x: 0, y: 0 } : { x: v.x / size, y: v.y / size };
}

function accelerate(body: Body, direction: Vec, amount: number): void {
  body.vx += direction.x * amount;
  body.vy += direction.y * amount;
}

function kick(racer: Racer, direction: Vec, speed: number, mods: MoveModifiers, events: EventSink<GameEvent>): void {
  const aim = direction.x === 0 && direction.y === 0 ? { x: racer.facing, y: 0 } : direction;
  accelerate(racer.body, kickImpulse(racer, aim, GLIDE_KICK_RULES), speed);
  racer.kickCooldown = mods.kickCooldownTicks;
  events.emit({ type: 'racer.kicked', id: racer.id });
}

function capSpeed(body: Body, maxSpeed: number): void {
  const speed = length(body.vx, body.vy);
  if (speed <= maxSpeed) return;
  body.vx *= maxSpeed / speed;
  body.vy *= maxSpeed / speed;
}

/** The glide medium. */
export const GLIDE_MEDIUM: Medium = {
  id: 'glide',
  tuning: GLIDE_TUNING,
  createMotion: (): GlideMotion => ({ kind: 'glide' }),
  createPilot: createGlidePilot,
  sampleEnvironment: () => STILL_AIR,
  applyIntent: applyGlide,
  buildNav: buildGlideNav,
  steer: steerGlider,
  enterCost: glideCost,
  aimFrom: glideAimFrom,
  nextTile: glideNextTile,
  distanceAt: glideDistanceAt,
  coralAhead: () => false,
  ramsCoral: () => false,
  validateLevel: validateGlideLevel,
  afterMove: () => {},
  racerCollision: 'ghost',
  effects: GLIDE_EFFECTS,
  kickRules: GLIDE_KICK_RULES,
};
