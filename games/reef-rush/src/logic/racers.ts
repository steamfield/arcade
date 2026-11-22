/**
 * Queries over a world's racers. Every module that needs "the player" or "who is
 * still racing" asks here, so each answer has one definition.
 */
import { RACER_IDS, type Racer, type World } from './types.ts';

/**
 * The player's racer.
 *
 * @throws {Error} When the world has no racer with id 'player'. createWorld always adds one, so
 * this means the world was assembled by hand without it.
 */
export function playerOf(world: World): Racer {
  const player = world.racers.find((racer) => racer.id === 'player');
  if (!player) {
    const ids = world.racers.map((racer) => racer.id).join(', ') || 'none';
    throw new Error(`World has no player racer (racers: ${ids}); build worlds with createWorld`);
  }
  return player;
}

/** Racers still in play (not yet finished), in RACER_IDS order. Finished racers don't swim, move or bump. */
export function activeRacers(world: World): Racer[] {
  return world.racers
    .filter((racer) => !racer.finished)
    .sort((a, b) => RACER_IDS.indexOf(a.id) - RACER_IDS.indexOf(b.id));
}
