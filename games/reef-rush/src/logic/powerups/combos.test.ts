import { TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { advanceProjectiles } from '../hazards/projectiles.ts';
import { advanceSquids } from '../hazards/squids.ts';
import { updateProgress } from '../race/standings.ts';
import { activeRacers, centreOf } from '../racers.ts';
import { eventsIn, hold, placeOnTile, raceOn, racerOf, step, ticksOf } from '../test-world.ts';
import type { PowerUpKind } from '../types.ts';
import { fireBurst } from './burst.ts';
import { comboFor, combosIn } from './combos.ts';
import { advanceDecoys } from './decoys.ts';
import { COMBO_PAIRS } from './tuning.ts';

/** The player's lane has coral at (4, 1) and (5, 1) and a way round below it. */
const LANES = `
  ####################
  #1..CC............F#
  #.................F#
  ####################
  #2................F#
  ####################
  #3................F#
  ####################
  #4................F#
  ####################
`;

const OPEN = `
  ##################
  #1..............F#
  #...............F#
  #...............F#
  #...............F#
  #2..............F#
  #...............F#
  #...............F#
  #3..............F#
  #4..............F#
  ##################
`;

/** OPEN with jellies at tiles (8, 3) and (12, 3). */
const JELLIES = OPEN.replace(
  '  #...............F#\n  #...............F#\n  #2',
  '  #.......j...j...F#\n  #...............F#\n  #2',
);

const RIGHT = { x: 1, y: 0 };

/** Holds right with burst on the first tick, then right alone, holding `kinds`. */
function dashRight(kinds: PowerUpKind[], ticks = 30) {
  const { world, log } = raceOn(LANES);
  const player = racerOf(world, 'player');
  player.stack = kinds;
  step(world, log, 1, hold(RIGHT, { burst: true }));
  step(world, log, ticks - 1, hold(RIGHT));
  return { world, log, player };
}

describe('naming combos', () => {
  it.each(COMBO_PAIRS)('names $name for its pair held in either order', ({ name, kinds: [a, b] }) => {
    expect(comboFor([a, b])).toBe(name);
    expect(comboFor([b, a])).toBe(name);
  });

  it('still names a combo with another kind held alongside the pair', () => {
    expect(comboFor(['inkSac', 'bubbleShield', 'jetFin'])).toBe('inkTrail');
  });

  it('names nothing for kinds that make no pair', () => {
    expect(comboFor(['bubbleShield', 'puffer'])).toBeNull();
    expect(comboFor(['glowLantern'])).toBeNull();
    expect(comboFor([])).toBeNull();
  });

  it('reports the first listed pair when three held kinds make several', () => {
    expect(combosIn(['inkSac', 'puffer', 'jetFin'])).toEqual(['cannonball', 'inkTrail', 'inkBomb']);
    expect(comboFor(['inkSac', 'puffer', 'jetFin'])).toBe('cannonball');
  });
});

describe('combo effects', () => {
  it('cannonball: the inflated dash smashes the coral in its path', () => {
    const { log } = dashRight(['jetFin', 'puffer']);

    expect(eventsIn(log, 'burst.fired')).toEqual([
      { type: 'burst.fired', id: 'player', kinds: ['jetFin', 'puffer'], combo: 'cannonball' },
    ]);
    expect(eventsIn(log, 'coral.broken')).toEqual([
      { type: 'coral.broken', tx: 4, ty: 1, by: 'player' },
      { type: 'coral.broken', tx: 5, ty: 1, by: 'player' },
    ]);
  });

  it('inkTrail: drops a cloud every 8 ticks along the dash instead of one', () => {
    const { world, log } = dashRight(['jetFin', 'inkSac']);
    const xs = world.inks.map((ink) => ink.x);

    expect(eventsIn(log, 'ink.spawned')).toHaveLength(3);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(new Set(xs).size).toBe(3);
  });

  it('lanternBubble: the bubble flies straight and stuns the jellies it passes, and the lantern flashes too', () => {
    const { world, log } = raceOn(JELLIES);
    const player = racerOf(world, 'player');
    placeOnTile(player, 2, 3);
    placeOnTile(racerOf(world, 'tess'), 9, 1);
    updateProgress(world);
    player.stack = ['bubbleShield', 'glowLantern'];
    fireBurst(world, player, RIGHT);
    for (let i = 0; i < 30; i++) advanceProjectiles(world, activeRacers(world), TICK_DT);

    expect(world.bubbles[0]).toMatchObject({ vx: 150, vy: 0, seeking: true });
    // The bubble has passed the jelly at tile (8, 3) but is still short of the one at (12, 3).
    expect(world.jellies.map((jelly) => jelly.stunned > 0)).toEqual([true, false]);
    expect(eventsIn(log, 'flash.fired')).toHaveLength(1);
  });

  it('surfline: lays no lane when fired, then a longer, stronger one where the dash ends', () => {
    const { world, log } = raceOn(OPEN);
    const player = racerOf(world, 'player');
    player.stack = ['jetFin', 'riptide'];
    step(world, log, 1, hold(RIGHT, { burst: true }));
    expect(world.riptides).toEqual([]);
    step(world, log, 22, hold(RIGHT));
    expect(world.riptides).toEqual([]);
    step(world, log, 1, hold(RIGHT));

    const [lane] = world.riptides;
    expect(world.riptides).toHaveLength(1);
    expect(lane).toMatchObject({ dir: RIGHT, owner: 'player', strength: 3, h: 32, ttl: 179 });
    expect(lane?.x).toBeCloseTo(centreOf(player).x, 0);
    // Twelve tiles would end past the wall at column 17, so the lane is cut at it.
    expect((lane?.x ?? 0) + (lane?.w ?? 0)).toBeGreaterThan(16 * 16);
    expect((lane?.x ?? 0) + (lane?.w ?? 0)).toBeLessThanOrEqual(17 * 16);
    expect(ticksOf(log, 'riptide.spawned')).toEqual([world.tick]);
  });

  it('surfline: a hit that ends the dash early lays no lane', () => {
    const { world, log } = raceOn(OPEN);
    const player = racerOf(world, 'player');
    player.stack = ['jetFin', 'riptide'];
    step(world, log, 1, hold(RIGHT, { burst: true }));
    player.status.dashing = 0;
    step(world, log, 30, hold(RIGHT));

    expect(world.riptides).toEqual([]);
  });

  it('inkSquid: drops no cloud behind, and the squid bursts one on the racer it latches', () => {
    const { world, log } = raceOn(OPEN);
    const player = racerOf(world, 'player');
    const tess = racerOf(world, 'tess');
    placeOnTile(player, 2, 4);
    placeOnTile(tess, 7, 4);
    updateProgress(world);
    player.stack = ['homingSquid', 'inkSac'];
    fireBurst(world, player, RIGHT);

    expect(world.inks).toEqual([]);
    for (let i = 0; i < 60 && world.squids.length > 0; i++) advanceSquids(world, activeRacers(world), TICK_DT);

    expect(eventsIn(log, 'squid.latched')).toEqual([{ type: 'squid.latched', id: 'tess', by: 'player' }]);
    expect(world.inks).toEqual([{ ...centreOf(tess), radius: 24, ttl: 240, owner: 'player' }]);
    expect(eventsIn(log, 'ink.spawned')).toEqual([{ type: 'ink.spawned', owner: 'player' }]);
  });

  it('bubbleDecoy: fires no bubble; the decoy wears one, and a racer that pops it is trapped', () => {
    const { world, log } = raceOn(OPEN);
    const player = racerOf(world, 'player');
    placeOnTile(player, 2, 4);
    player.stack = ['mimic', 'bubbleShield'];
    fireBurst(world, player, RIGHT);

    expect(world.bubbles).toEqual([]);
    expect(world.decoys).toHaveLength(1);
    expect(world.decoys[0]).toMatchObject({ owner: 'player', bubbled: true });

    placeOnTile(racerOf(world, 'tess'), 2, 4);
    advanceDecoys(world, TICK_DT);

    expect(world.decoys).toEqual([]);
    expect(racerOf(world, 'tess').status.trapped).toBeGreaterThan(0);
    expect(eventsIn(log, 'decoy.popped')).toEqual([{ type: 'decoy.popped', owner: 'player', by: 'tess' }]);
  });

  it('inkBomb: one 48 px cloud centred on the racer', () => {
    const { world } = raceOn(OPEN);
    const player = racerOf(world, 'player');
    player.stack = ['puffer', 'inkSac'];

    fireBurst(world, player, RIGHT);

    expect(world.inks).toEqual([{ ...centreOf(player), radius: 24, ttl: 240, owner: 'player' }]);
  });

  it('comet: flashes as the dash starts and again on its last tick', () => {
    const { log } = dashRight(['jetFin', 'glowLantern']);
    const [start, end] = ticksOf(log, 'flash.fired');

    expect(ticksOf(log, 'flash.fired')).toHaveLength(2);
    expect((end ?? 0) - (start ?? 0)).toBe(23);
  });

  it('applies every matching combo when three kinds are held', () => {
    const { world, log } = dashRight(['jetFin', 'puffer', 'inkSac'], 20);

    expect(eventsIn(log, 'burst.fired')).toEqual([
      { type: 'burst.fired', id: 'player', kinds: ['jetFin', 'puffer', 'inkSac'], combo: 'cannonball' },
    ]);
    expect(world.inks.map((ink) => ink.radius)).toEqual([24, 24, 24]);
    expect(eventsIn(log, 'coral.broken')).toHaveLength(2);
  });
});
