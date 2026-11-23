/**
 * Queries over a world's racers. Every module that needs "the player", "who is
 * still racing", a racer's centre or its hitbox asks here, so each answer has one
 * definition. Also the one definition of a racer's empty item state.
 */
import { INFLATE } from './powerups/tuning.ts';
import { type Box, RACER_IDS, type Racer, type Vec, type World } from './types.ts';

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

/** Centre of a racer's body in world pixels. */
export function centreOf(racer: Racer): Vec {
  return { x: racer.body.x + racer.body.w / 2, y: racer.body.y + racer.body.h / 2 };
}

/**
 * The box hazards, pickups and other racers touch: the body, or an INFLATE.size square centred on
 * it while inflated. Tile collision always uses the body, so an inflated racer still fits corridors.
 */
export function hitbox(racer: Racer): Box {
  const { x, y, w, h } = racer.body;
  if (racer.status.inflated === 0) return { x, y, w, h };
  const centre = centreOf(racer);
  return { x: centre.x - INFLATE.size / 2, y: centre.y - INFLATE.size / 2, w: INFLATE.size, h: INFLATE.size };
}

/**
 * A racer's item and ability fields at the start line: `slots` empty inventory slots with the first
 * selected, no statuses, item use ready, ability counters at 0.
 */
export function noItems(
  slots: number,
): Pick<Racer, 'items' | 'selected' | 'useCooldown' | 'pearls' | 'status' | 'dashDir' | 'dashSpeed' | 'ability'> {
  return {
    items: Array.from({ length: slots }, () => null),
    selected: 0,
    useCooldown: 0,
    pearls: 0,
    status: {
      stunned: 0,
      invulnerable: 0,
      cannonball: 0,
      slowed: 0,
      trapped: 0,
      inflated: 0,
      dashing: 0,
      boost: 0,
      latched: 0,
      undertow: 0,
      bonking: 0,
      fallen: 0,
    },
    dashDir: { x: 0, y: 0 },
    dashSpeed: 0,
    ability: { windUp: 0, frenzy: 0 },
  };
}
