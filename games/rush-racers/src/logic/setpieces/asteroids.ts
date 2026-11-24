/**
 * Drifting asteroids, Slingshot Alley's set piece: bodies gliding back and forth on straight tracks,
 * placed by a pure function of the race tick, that hit racers they touch (`LevelDef.asteroids`).
 *
 * Each asteroid runs a cycle of `periodTicks` race ticks shifted by `offsetTicks`: the first half
 * glides from the centre of tile `from` to the centre of tile `to`, the second half glides back.
 * Each leg eases in and out (smoothstep, a cubic), so the asteroid slows to a stop at each end and
 * turns smoothly instead of bouncing.
 */

import { applyHit } from '../hazards/hits.ts';
import { errorAt } from '../level/level-error.ts';
import { hitbox } from '../racers.ts';
import { type AsteroidDef, type Box, type Racer, TILE, type Vec, type World } from '../types.ts';

/** The shortest cycle an asteroid may run: one second there and back. */
export const MIN_ASTEROID_PERIOD_TICKS = 60;

/**
 * Checks a level's asteroids and returns them in the order written.
 *
 * @throws {LevelError} At the tile at fault for an end of a track off the map, a period under
 *   `MIN_ASTEROID_PERIOD_TICKS`, or a radius that isn't positive.
 */
export function parseAsteroids(defs: readonly AsteroidDef[], width: number, height: number): AsteroidDef[] {
  return defs.map((def) => {
    for (const [col, row] of [def.from, def.to]) {
      if (col < 0 || col >= width || row < 0 || row >= height)
        throw errorAt('An asteroid track ends off the map', row, col);
    }
    const [col, row] = def.from;
    if (!(def.periodTicks >= MIN_ASTEROID_PERIOD_TICKS)) {
      throw errorAt(
        `An asteroid's period must be at least ${MIN_ASTEROID_PERIOD_TICKS} ticks, not ${def.periodTicks},`,
        row,
        col,
      );
    }
    if (!(def.radius > 0)) throw errorAt(`An asteroid's radius must be positive, not ${def.radius},`, row, col);
    return def;
  });
}

/** Where asteroid `def` is at race tick `raceTick`, in px; the engine draws it from this too. */
export function asteroidAt(def: AsteroidDef, raceTick: number): Vec {
  const from = tileCentre(def.from);
  const to = tileCentre(def.to);
  const along = easedLeg(cycleFraction(def, raceTick));
  return { x: from.x + (to.x - from.x) * along, y: from.y + (to.y - from.y) * along };
}

/**
 * The asteroids slot of `stepRace`: hits each racer an asteroid touches (cause 'asteroid', no owner),
 * knocked back from the asteroid's centre. `applyHit` skips fallen and invulnerable racers, so the
 * second of invulnerability after a hit stops the same asteroid hitting twice as it passes.
 */
export function strikeAsteroids(world: World, racing: readonly Racer[]): void {
  const raceTick = world.race.raceTick;
  for (const def of world.level.asteroids) {
    const centre = asteroidAt(def, raceTick);
    const reach = def.radius * TILE;
    for (const racer of racing) {
      if (distanceToBox(centre, hitbox(racer)) < reach) applyHit(world, racer, 'asteroid', null, centre);
    }
  }
}

/** How far into its cycle `def` is on `raceTick`, from 0 (inclusive) to 1 (exclusive). */
function cycleFraction(def: AsteroidDef, raceTick: number): number {
  const shifted = (raceTick + def.offsetTicks) % def.periodTicks;
  // `%` keeps the dividend's sign, so a negative tick needs a period added to land in the cycle.
  const tick = shifted < 0 ? shifted + def.periodTicks : shifted;
  return tick / def.periodTicks;
}

/**
 * How far along the track from `from` to `to` an asteroid is at cycle fraction `u`: out over the
 * first half and back over the second, each leg on smoothstep (3t² - 2t³), whose speed is zero at
 * both ends, so the turn is smooth.
 */
function easedLeg(u: number): number {
  const t = u < 0.5 ? u * 2 : 2 - u * 2;
  return t * t * (3 - 2 * t);
}

function tileCentre([col, row]: readonly [number, number]): Vec {
  return { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE };
}

/** Distance in px from `point` to the nearest point of `box`; 0 when the point is inside it. */
function distanceToBox(point: Vec, box: Box): number {
  const dx = Math.max(box.x - point.x, 0, point.x - (box.x + box.w));
  const dy = Math.max(box.y - point.y, 0, point.y - (box.y + box.h));
  return Math.sqrt(dx * dx + dy * dy);
}
