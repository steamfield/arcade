/**
 * A drift rival's velocity control: the velocity it wants along its aim, and the stick that gets it
 * there. The stick follows the acceleration it needs: toward the wanted velocity, less the part of
 * the gravity wells' pull that doesn't already help. So it lets a planet do the work where the pull
 * points the way it wants to go, and burns against a pull that points elsewhere, such as out of a
 * black hole's reach. Used only by `pilot.ts`.
 */
import { TICK_DT } from '@arcade/core';
import { length } from '../../num.ts';
import { centreOf } from '../../racers.ts';
import { type MoveModifiers, type Racer, TILE, type Vec, type World } from '../../types.ts';
import { effectiveTuning } from '../index.ts';
import { driftPullAt } from './env.ts';
import { freeDistanceAlong } from './lookahead.ts';
import { driftCruise, driftExtras } from './tuning.ts';
import type { DriftRoute } from './way.ts';

/** How far ahead along its velocity, in px, it looks for a wall it must be able to stop before. */
const BRAKE_LOOKAHEAD_PX = 8 * TILE;
/**
 * Share of its thrust it counts on for braking. It holds the stick toward the velocity it wants, not
 * straight back, so it brakes at less than full thrust while it turns.
 */
const BRAKE_SHARE = 0.6;
/** Below this gap, in px/s, between its velocity and the one it wants, it simply thrusts along its aim. */
const SETTLED_PX_S = 0.5;
/** The acceleration, px/s², of closing a settled gap in one tick: below it there is nothing to burn for. */
const SETTLED_PX_S2 = SETTLED_PX_S / TICK_DT;

/**
 * The velocity a rival wants: along `aim` at the larger of its cruise and the speed it has along the
 * aim, with the part along its current heading capped at what it can shed before the first wall
 * within BRAKE_LOOKAHEAD_PX that way. The part across its heading is kept, so it turns away from a
 * wall it is braking for instead of stopping short of it. On the smash or ram `route`, ice is no wall.
 *
 * @throws {Error} When the world's tuning lacks one of drift's extras, or its nav isn't drift's.
 */
export function wantedVelocity(world: World, racer: Racer, aim: Vec, mods: MoveModifiers, route: DriftRoute): Vec {
  const tuning = effectiveTuning(world);
  // Open-space cruise: the pilot plans as if clear of dust, and drag slows it to dust cruise inside.
  const cruise = driftCruise(driftExtras(tuning), mods.forceMul, false);
  const { vx, vy } = racer.body;
  const speed = length(vx, vy);
  const target = Math.max(cruise, vx * aim.x + vy * aim.y);
  const wanted = { x: aim.x * target, y: aim.y * target };
  const heading = speed > SETTLED_PX_S ? { x: vx / speed, y: vy / speed } : aim;
  // A rival on the smash or ram field means to break the ice ahead, so ice is no wall to brake for.
  const free = freeDistanceAlong(world, racer.body, heading, BRAKE_LOOKAHEAD_PX, route !== 'steer');
  if (free >= BRAKE_LOOKAHEAD_PX) return wanted;
  const along = wanted.x * heading.x + wanted.y * heading.y;
  const canShed = Math.sqrt(2 * tuning.force * mods.forceMul * BRAKE_SHARE * free);
  if (along <= canShed) return wanted;
  return { x: wanted.x - heading.x * (along - canShed), y: wanted.y - heading.y * (along - canShed) };
}

/** `vector` as a unit vector; `fallback` when it is zero. */
export function unitOr(vector: Vec, fallback: Vec): Vec {
  const size = length(vector.x, vector.y);
  return size === 0 ? { ...fallback } : { x: vector.x / size, y: vector.y / size };
}

/**
 * The unit stick along the acceleration that takes the racer's velocity to `wanted`: the gap closed
 * in one tick, no harder than its thrust, less the part of the wells' pull that doesn't help
 * (`unhelpfulPull`). Along `aim` once nothing is left to do.
 *
 * @throws {Error} When the world's tuning lacks one of drift's extras.
 */
export function stickToward(world: World, racer: Racer, wanted: Vec, aim: Vec, mods: MoveModifiers): Vec {
  const thrust = effectiveTuning(world).force * mods.forceMul;
  const closing = limitLength(
    { x: (wanted.x - racer.body.vx) / TICK_DT, y: (wanted.y - racer.body.vy) / TICK_DT },
    thrust,
  );
  const against = unhelpfulPull(driftPullAt(world, centreOf(racer)), wanted);
  const needed = { x: closing.x - against.x, y: closing.y - against.y };
  const size = length(needed.x, needed.y);
  return size < SETTLED_PX_S2 ? { ...aim } : { x: needed.x / size, y: needed.y / size };
}

/**
 * The part of `pull` the rival has to burn against: all of it when it points away from `wanted` (or
 * there is no wanted velocity), else only its part across `wanted`, since the part along it is
 * already speeding the rival the way it wants to go.
 */
function unhelpfulPull(pull: Vec, wanted: Vec): Vec {
  const size = length(wanted.x, wanted.y);
  if (size === 0) return pull;
  const along = (pull.x * wanted.x + pull.y * wanted.y) / size;
  if (along <= 0) return pull;
  return { x: pull.x - (wanted.x / size) * along, y: pull.y - (wanted.y / size) * along };
}

/** `vector` shortened to `limit` if it is longer. */
function limitLength(vector: Vec, limit: number): Vec {
  const size = length(vector.x, vector.y);
  if (size <= limit) return vector;
  return { x: (vector.x / size) * limit, y: (vector.y / size) * limit };
}
