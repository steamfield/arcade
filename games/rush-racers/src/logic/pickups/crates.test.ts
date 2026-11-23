/**
 * Solid crates: in a medium whose clams are solid, a ready clam blocks like rock and opens only when
 * a racer's head hits it from below. In swim, clams open on touch as they always have.
 */
import { describe, expect, it } from 'vitest';
import { PLATFORM_ARENA_TOP, platformArena } from '../conformance/platform-medium.ts';
import { eventsIn, giveItems, placeAt, racerOf, step } from '../test-world.ts';
import { TILE } from '../types.ts';

/** A crate at column 5, row 1 of the player area, with open air under it down to the floor. */
const UNDER_CRATE = ['###########', '#.........F', '#....?....F', '#.........F', '#1........F', '###########'].map(
  (row) => `${row}#`,
);
const CRATE = { tx: 5, ty: PLATFORM_ARENA_TOP + 2 };

/** Puts the player under the crate, `below` px under its bottom edge, rising at `vy`. */
function underCrate(below: number, vy: number) {
  const race = platformArena(UNDER_CRATE);
  const player = racerOf(race.world, 'player');
  placeAt(player, { x: (CRATE.tx + 0.5) * TILE, y: (CRATE.ty + 1) * TILE + below + player.body.h / 2 });
  player.body.vy = vy;
  return { ...race, player };
}

describe('a solid crate', () => {
  it('opens for a racer whose head hits it from below, and stops the racer', () => {
    const { world, log, player } = underCrate(2, -150);

    step(world, log, 4);

    expect(eventsIn(log, 'clam.opened')).toEqual([expect.objectContaining({ id: 'player', index: 0 })]);
    expect(player.body.y).toBeGreaterThanOrEqual((CRATE.ty + 1) * TILE);
  });

  it('holds a racer landing on top of it without opening', () => {
    const { world, log } = platformArena(UNDER_CRATE);
    const player = racerOf(world, 'player');
    placeAt(player, { x: (CRATE.tx + 0.5) * TILE, y: CRATE.ty * TILE - player.body.h / 2 - 2 });
    player.body.vy = 100;

    step(world, log, 20);

    expect(eventsIn(log, 'clam.opened')).toEqual([]);
    expect(player.body.y + player.body.h).toBeCloseTo(CRATE.ty * TILE, 0);
  });

  it('stays shut and solid for a racer with a full inventory', () => {
    const { world, log, player } = underCrate(2, -150);
    giveItems(player, ['jetFin', 'puffer', 'inkSac']);

    step(world, log, 4);

    expect(eventsIn(log, 'clam.opened')).toEqual([]);
    expect(player.body.y).toBeGreaterThanOrEqual((CRATE.ty + 1) * TILE);
    expect(world.clams[0]?.closedFor).toBe(0);
  });

  it('lets a racer through while it is shut after opening', () => {
    const { world, log, player } = underCrate(2, -150);
    step(world, log, 4);
    expect(world.clams[0]?.closedFor).toBeGreaterThan(0);

    placeAt(player, { x: (CRATE.tx + 0.5) * TILE, y: (CRATE.ty + 1) * TILE + 2 + player.body.h / 2 });
    player.body.vy = -150;
    step(world, log, 6);

    expect(player.body.y).toBeLessThan((CRATE.ty + 1) * TILE);
  });
});
