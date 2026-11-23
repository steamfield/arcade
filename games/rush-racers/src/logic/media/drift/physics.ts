/**
 * Drifting: how one racer's velocity responds to its intent and its surroundings, the drift
 * medium's `applyIntent`. Velocity, facing and kick cooldown only; position is moved by
 * `race/move.ts`. Every number comes from the tuning it is handed.
 */
import type { EventSink } from '@arcade/core';
import { kickImpulse } from '../../abilities.ts';
import type { GameEvent } from '../../events.ts';
import { length } from '../../num.ts';
import type { Body, Intent, MoveModifiers, Racer } from '../../types.ts';
import type { MediumEnv, MediumTuning } from '../types.ts';
import { type DriftMotion, driftEnv } from './data.ts';
import { DRIFT_KICK_RULES, driftExtras } from './tuning.ts';

/** A drifter's movement state at the start line. */
export function createDriftMotion(_body: Body): DriftMotion {
  return { kind: 'drift' };
}

/**
 * Updates a racer's velocity, facing and kick cooldown for one tick. A rough stand-in: thrust
 * along the stick limited to cruise, a constant drag with `overDrag` over cruise, a dash and the
 * speed cap. No wind, dust, idle brake or forceMul on cruise yet.
 *
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
  driftEnv(env);
  const { body } = racer;
  const size = length(intent.move.x, intent.move.y);
  const stick = size === 0 ? { x: 0, y: 0 } : { x: intent.move.x / size, y: intent.move.y / size };
  if (intent.move.x !== 0) racer.facing = intent.move.x > 0 ? 1 : -1;
  const limit = Math.max(length(body.vx, body.vy), extras.cruise);
  body.vx += stick.x * tuning.force * mods.forceMul * dt;
  body.vy += stick.y * tuning.force * mods.forceMul * dt;
  const thrusted = length(body.vx, body.vy);
  if (thrusted > limit) {
    body.vx *= limit / thrusted;
    body.vy *= limit / thrusted;
  }
  const over = length(body.vx, body.vy) > extras.cruise ? extras.overDrag : 0;
  slow(body, (tuning.drag + over) * mods.dragMul * dt);
  if (intent.kick && racer.kickCooldown === 0) {
    const aim = size === 0 ? { x: racer.facing, y: 0 } : stick;
    const impulse = kickImpulse(racer, aim, DRIFT_KICK_RULES);
    body.vx += impulse.x * tuning.kick * mods.kickMul;
    body.vy += impulse.y * tuning.kick * mods.kickMul;
    racer.kickCooldown = mods.kickCooldownTicks;
    events.emit({ type: 'racer.kicked', id: racer.id });
  } else if (racer.kickCooldown > 0) racer.kickCooldown -= 1;
  const speed = length(body.vx, body.vy);
  if (speed > tuning.maxSpeed) {
    body.vx *= tuning.maxSpeed / speed;
    body.vy *= tuning.maxSpeed / speed;
  }
}

/** Takes `amount` px/s off the body's speed along its velocity, stopping at rest. */
function slow(body: Body, amount: number): void {
  const speed = length(body.vx, body.vy);
  if (speed === 0) return;
  const keep = Math.max(0, speed - amount) / speed;
  body.vx *= keep;
  body.vy *= keep;
}
