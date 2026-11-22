import { TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { advanceProjectiles } from '../hazards/projectiles.ts';
import { updateProgress } from '../race/standings.ts';
import { activeRacers, centreOf } from '../racers.ts';
import { eventsIn, hold, placeOnTile, raceOn, racerOf, step, ticksOf } from '../test-world.ts';
import type { PowerUpKind } from '../types.ts';
import { fireBurst } from './burst.ts';
import { comboFor, combosIn } from './combos.ts';
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

  it('lanternBubble: the bubble turns toward the racer ahead by at most 4 degrees a tick', () => {
    const { world } = raceOn(OPEN);
    const player = racerOf(world, 'player');
    placeOnTile(player, 2, 2);
    placeOnTile(racerOf(world, 'tess'), 9, 5);
    updateProgress(world);
    player.stack = ['bubbleShield', 'glowLantern'];
    fireBurst(world, player, RIGHT);
    const headings: number[] = [];
    for (let i = 0; i < 15; i++) {
      advanceProjectiles(world, activeRacers(world), TICK_DT);
      const bubble = world.bubbles[0];
      if (bubble) headings.push(Math.atan2(bubble.vy, bubble.vx));
    }
    const turns = headings.map((heading, i) => heading - (headings[i - 1] ?? 0));

    expect(headings).toHaveLength(15);
    expect(Math.max(...turns.map(Math.abs))).toBeLessThanOrEqual((4 * Math.PI) / 180 + 1e-9);
    expect(headings.at(-1)).toBeGreaterThan(0.1);
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
