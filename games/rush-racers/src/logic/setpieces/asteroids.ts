/**
 * Drifting asteroids, Slingshot Alley's set piece: bodies gliding back and forth on straight tracks,
 * placed by a pure function of the race tick, that hit racers they touch (`LevelDef.asteroids`).
 */
import type { AsteroidDef, Racer, Vec, World } from '../types.ts';

/**
 * Checks a level's asteroids and returns them in the order written.
 *
 * @throws {LevelError} For an end of a track off the map, or a period or radius that isn't positive.
 */
export function parseAsteroids(defs: readonly AsteroidDef[], width: number, height: number): AsteroidDef[] {
  if (defs.length === 0) return [];
  throw new Error(`parseAsteroids not implemented (${width}x${height})`);
}

/** Where asteroid `index` is at race tick `raceTick`, in px; the engine draws it from this too. */
export function asteroidAt(def: AsteroidDef, raceTick: number): Vec {
  throw new Error(`asteroidAt not implemented (${def.periodTicks}, ${raceTick})`);
}

/** The asteroids slot of `stepRace`: hits each racer an asteroid touches (cause 'asteroid'). */
export function strikeAsteroids(world: World, racing: readonly Racer[]): void {
  if (world.level.asteroids.length === 0) return;
  throw new Error(`strikeAsteroids not implemented (${racing.length} racers)`);
}
