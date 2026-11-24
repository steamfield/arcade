/**
 * How a drift pilot lets a crossing asteroid go by (`setpieces/asteroids.ts`): it projects its own
 * flight along the velocity it wants and each nearby asteroid's glide a short way ahead, and when they
 * would meet, it slows to the fastest pace that lets the asteroid pass, stopping if it must. Only
 * `pilot.ts` reads this.
 */
import { TICK_DT } from '@arcade/core';
import { centreOf, isRival } from '../../racers.ts';
import { asteroidAt } from '../../setpieces/asteroids.ts';
import { type AsteroidDef, type Racer, TILE, type Vec, type World } from '../../types.ts';

/**
 * How far ahead a pilot looks, in ticks, and the step between looks; the clearance it keeps beyond an
 * asteroid's radius and its own half size, px; how far away an asteroid's track must pass, in
 * tiles, before it is considered at all; and the paces it tries.
 */
export const ASTEROID_WAIT = {
  lookaheadTicks: 36,
  stepTicks: 3,
  marginPx: 6,
  nearTiles: 10,
  /** The shares of its wanted velocity a rival tries, fastest first. */
  paces: [1, 0.75, 0.5, 0.25, 0],
} as const;

/**
 * The share of `wanted` a rival flies at so a drifting asteroid passes ahead of it: the largest of
 * ASTEROID_WAIT.paces at which it would not meet one within the look-ahead, so it slows only as much
 * as it must, and 0 when it must stop. 1 when no pace is safe (holding back would not help), outside
 * a race, where the asteroids have no race tick to be placed by, and for a bot driving a human slot:
 * a person times the crossing their own way, and the difficulty bars measure the bots as such players.
 */
export function asteroidPace(world: World, racer: Racer, wanted: Vec): number {
  if (world.race.phase !== 'racing' || !isRival(world, racer.id)) return 1;
  const centre = centreOf(racer);
  const near = world.level.asteroids.filter((def) => trackPassesNear(def, centre));
  if (near.length === 0) return 1;
  const clearance = (racer.body.w + racer.body.h) / 4 + ASTEROID_WAIT.marginPx;
  const meets = (pace: number) =>
    near.some((def) => meetsAhead(world, def, centre, { x: wanted.x * pace, y: wanted.y * pace }, clearance));
  return ASTEROID_WAIT.paces.find((pace) => !meets(pace)) ?? 1;
}

/**
 * True when a body leaving `centre` at `velocity` comes within the asteroid's radius plus `clearance`
 * of it on one of the looks ahead.
 */
function meetsAhead(world: World, def: AsteroidDef, centre: Vec, velocity: Vec, clearance: number): boolean {
  const reach = def.radius * TILE + clearance;
  for (let ahead = ASTEROID_WAIT.stepTicks; ahead <= ASTEROID_WAIT.lookaheadTicks; ahead += ASTEROID_WAIT.stepTicks) {
    const seconds = ahead * TICK_DT;
    const at = asteroidAt(def, world.race.raceTick + ahead);
    const dx = centre.x + velocity.x * seconds - at.x;
    const dy = centre.y + velocity.y * seconds - at.y;
    if (dx * dx + dy * dy < reach * reach) return true;
  }
  return false;
}

/** True when `point` lies within ASTEROID_WAIT.nearTiles of the box around the asteroid's track. */
function trackPassesNear(def: AsteroidDef, point: Vec): boolean {
  const reach = ASTEROID_WAIT.nearTiles * TILE;
  const box = {
    left: (Math.min(def.from[0], def.to[0]) + 0.5) * TILE - reach,
    right: (Math.max(def.from[0], def.to[0]) + 0.5) * TILE + reach,
    top: (Math.min(def.from[1], def.to[1]) + 0.5) * TILE - reach,
    bottom: (Math.max(def.from[1], def.to[1]) + 0.5) * TILE + reach,
  };
  return point.x > box.left && point.x < box.right && point.y > box.top && point.y < box.bottom;
}
