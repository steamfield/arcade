/**
 * Cloud cannons, Cloudreach's set piece: a cannon catches a racer, holds it, then fires it along its
 * aim for a set time (`LevelDef.cannons`). Rides live in `World.cannonRides`.
 */
import type { CannonDef, Cell, Racer, World } from '../types.ts';

/** Cloud cannon numbers: the lane that builds them fills this in. */
export const CANNON = {} as const;

/**
 * Checks a level's cloud cannons against its cells and returns them in the order written.
 *
 * @throws {LevelError} For a cannon off the map or not on an open tile, a dir of (0, 0) or outside
 *   -1..1, a speed or flightTicks out of range, or two cannons on one tile.
 */
export function parseCannons(defs: readonly CannonDef[], cells: readonly (readonly Cell[])[]): CannonDef[] {
  if (defs.length === 0) return [];
  throw new Error(`parseCannons not implemented (${cells.length} rows)`);
}

/**
 * Moves `racer` for this tick if a cannon holds it or has fired it, in place of the medium's
 * movement (`moveRacer` in `world.ts` skips gravity, flaps, dashes and drifts for it).
 *
 * @returns true when the racer is riding and has been moved; false to move it the usual way.
 */
export function rideCannon(world: World, racer: Racer, dt: number): boolean {
  if (world.cannonRides.length === 0) return false;
  throw new Error(`rideCannon not implemented (${racer.id}, ${dt})`);
}

/** The cloud cannons slot of `stepRace`: catches, holds, fires and flies riders; emits `cannon.*`. */
export function fireCannons(world: World, racing: readonly Racer[]): void {
  if (world.level.cannons.length === 0) return;
  throw new Error(`fireCannons not implemented (${racing.length} racers)`);
}
