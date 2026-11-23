/**
 * The local racer: the slot this screen follows with its camera, HUD, sounds and effects. The
 * runtime registers it for each race with `setLocalRacer`; views that hold only a world ask
 * `localOf` or `localIdOf`. A world nobody registered follows slot `player`, so views built in
 * tests, and every race without `?local=`, behave as they always have.
 */
import type { Racer, RacerId, World } from '../logic/types.ts';

/** The slot each registered world's screen follows. Weak, so a finished race's world can be collected. */
const followed = new WeakMap<World, RacerId>();

/** Makes `id` the racer this screen follows in `world`. */
export function setLocalRacer(world: World, id: RacerId): void {
  followed.set(world, id);
}

/** The slot this screen follows in `world`: the one `setLocalRacer` set, else `player`. */
export function localIdOf(world: World): RacerId {
  return followed.get(world) ?? 'player';
}

/**
 * The racer this screen follows in `world`.
 *
 * @throws {Error} When the world has no racer in the followed slot. createWorld always fills every
 * slot, so this means the world was assembled by hand without it.
 */
export function localOf(world: World): Racer {
  const id = localIdOf(world);
  const racer = world.racers.find((candidate) => candidate.id === id);
  if (!racer) {
    const ids = world.racers.map((candidate) => candidate.id).join(', ') || 'none';
    throw new Error(`World has no racer '${id}' to follow (racers: ${ids}); build worlds with createWorld`);
  }
  return racer;
}
