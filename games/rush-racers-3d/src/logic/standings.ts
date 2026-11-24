/** Who is where in the race: finished racers by finish time, then the rest by distance along `s`. */
import type { RacerId, World } from './types.ts';

/** Racer ids from first to last: finished by `finishTicks`, then unfinished by `s`, ties by slot order. */
export function places(world: World): RacerId[] {
  return world.racers
    .map((racer, slot) => ({ racer, slot }))
    .sort((a, b) => {
      const af = a.racer.finishTicks;
      const bf = b.racer.finishTicks;
      if (af !== null && bf !== null) return af - bf || a.slot - b.slot;
      if (af !== null) return -1;
      if (bf !== null) return 1;
      return b.racer.s - a.racer.s || a.slot - b.slot;
    })
    .map(({ racer }) => racer.id);
}

/**
 * `id`'s 1-based place.
 *
 * @throws {Error} When no racer in `world` has that id.
 */
export function placeOf(world: World, id: RacerId): number {
  const place = places(world).indexOf(id);
  if (place < 0) throw new Error(`placeOf: no racer ${id} in this world`);
  return place + 1;
}
