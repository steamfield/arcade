import { describe, expect, it } from 'vitest';
import { SWIM_TUNING } from '../media/swim/tuning.ts';
import { modifiersFor } from '../modifiers.ts';
import { PEARL } from '../powerups/tuning.ts';
import { activeRacers, centreOf } from '../racers.ts';
import { eventsIn, giveItems, hold, placeOnTile, raceOn, racerOf, step, tileCentre } from '../test-world.ts';
import { type LoosePearl, TILE, type Vec } from '../types.ts';
import { collectPearls } from './pearls.ts';

/** Pearls at tiles (5, 2) and (6, 2) in open water. */
const PEARL_BOX = `
  ############
  #1........F#
  #2...oo...F#
  #3........F#
  #4........F#
  ############
`;

function setup() {
  const { world, log } = raceOn(PEARL_BOX);
  return { world, log, player: racerOf(world, 'player'), tess: racerOf(world, 'tess'), racers: activeRacers(world) };
}

describe('collecting pearls', () => {
  it('counts a touched pearl and gives 30 ticks of boost', () => {
    const { world, log, player, racers } = setup();
    placeOnTile(player, 5, 2);

    collectPearls(world, racers);

    expect(player.pearls).toBe(1);
    expect(player.status.boost).toBe(PEARL.boostTicks);
    expect([...world.pearlsTaken]).toEqual([0]);
    expect(eventsIn(log)).toEqual([{ type: 'pearl.collected', id: 'player', index: 0, total: 1 }]);
  });

  it('collects each pearl once per race, for whoever touches it first', () => {
    const { world, log, player, tess, racers } = setup();
    placeOnTile(player, 5, 2);
    collectPearls(world, racers);
    placeOnTile(player, 5, 4);
    placeOnTile(tess, 5, 2);

    collectPearls(world, racers);
    collectPearls(world, racers);

    expect(tess.pearls).toBe(0);
    expect(eventsIn(log, 'pearl.collected')).toHaveLength(1);
  });

  it('reports the racer running total with each pearl', () => {
    const { world, log, player, racers } = setup();
    placeOnTile(player, 5, 2);
    collectPearls(world, racers);
    placeOnTile(player, 6, 2);

    collectPearls(world, racers);

    expect(player.pearls).toBe(2);
    expect(eventsIn(log, 'pearl.collected')).toEqual([
      { type: 'pearl.collected', id: 'player', index: 0, total: 1 },
      { type: 'pearl.collected', id: 'player', index: 1, total: 2 },
    ]);
  });
});

describe('two racers reaching one pearl on the same tick', () => {
  it('goes to the first in RACER_IDS order, even when it only reaches by lantern', () => {
    const { world, log, player, tess, racers } = setup();
    giveItems(player, ['glowLantern']);
    placeOnTile(player, 2, 2);
    placeOnTile(tess, 5, 2);

    collectPearls(world, racers);

    expect(eventsIn(log)).toEqual([{ type: 'pearl.collected', id: 'player', index: 0, total: 1 }]);
    expect(tess.pearls).toBe(0);
  });
});

describe('pearls as speed', () => {
  it('raise swim force 1% per pearl, up to 10 pearls', () => {
    const { world, player } = setup();
    const forceWith = (pearls: number) => {
      player.pearls = pearls;
      return modifiersFor(world, player).forceMul;
    };

    expect([0, 1, 10, 25].map(forceWith)).toEqual([1, 1.01, 1.1, 1.1].map((mul) => SWIM_TUNING.base.forceMul * mul));
  });

  it('carry a racer holding ten further in a second of swimming than one holding none', () => {
    const swum = (pearls: number) => {
      const { world, log, player } = setup();
      player.pearls = pearls;
      const start = centreOf(player).x;
      step(world, log, 60, hold({ x: 1, y: 0 }));
      return centreOf(player).x - start;
    };

    expect(swum(10)).toBeGreaterThan(swum(0) * 1.05);
  });
});

/** Lanes one tile high with an urchin in the player's lane at (8, 1). */
const URCHIN_LANES = `
  ####################
  #1......*.........F#
  ####################
  #2................F#
  ####################
  #3................F#
  ####################
  #4................F#
  ####################
`;

/** One walled lane per racer, and an empty fifth lane (row 9) nobody swims in. */
const QUIET_LANES = `
  ####################
  #1................F#
  ####################
  #2................F#
  ####################
  #3................F#
  ####################
  #4................F#
  ####################
  #.................F#
  ####################
`;

function quiet() {
  const { world, log } = raceOn(QUIET_LANES);
  return { world, log, player: racerOf(world, 'player') };
}

const LOOSE_EVENTS = ['loosePearl.collected', 'pearls.dropped'] as const;

/** A loose pearl at rest at `at`, just dropped by `droppedBy`. */
const looseAt = (at: Vec, droppedBy: LoosePearl['droppedBy'] = 'tess'): LoosePearl => ({
  at: { ...at },
  vel: { x: 0, y: 0 },
  age: 0,
  droppedBy,
});

describe('loose pearls', () => {
  it('scatter from a racer that swims into an urchin, into open water only', () => {
    const { world, log } = raceOn(URCHIN_LANES);
    const player = racerOf(world, 'player');
    player.pearls = 4;

    step(world, log, 120, hold({ x: 1, y: 0 }));

    expect(eventsIn(log, 'pearls.dropped')).toEqual([{ type: 'pearls.dropped', id: 'player', count: 3 }]);
    expect(player.pearls + world.loosePearls.length).toBe(4);
    for (const pearl of world.loosePearls) {
      expect(Math.floor(pearl.at.y / TILE), `pearl at ${pearl.at.x},${pearl.at.y}`).toBe(1);
    }
  });

  it('settle with drag, stopping at rock instead of entering it', () => {
    const { world, log } = quiet();
    const free = { ...looseAt(tileCentre(4, 9)), vel: { x: 60, y: 0 } };
    const atWall = { ...looseAt(tileCentre(12, 9)), vel: { x: 0, y: 300 } };
    world.loosePearls = [free, atWall];

    step(world, log, 120);

    expect(world.loosePearls).toEqual([free, atWall]);
    expect(free.at.x).toBeGreaterThan(tileCentre(4, 9).x + 5);
    expect(free.at.x).toBeLessThan(tileCentre(4, 9).x + 20);
    expect(Math.abs(free.vel.x)).toBeLessThan(0.01);
    expect(atWall.at.y).toBeGreaterThan(tileCentre(12, 9).y);
    expect(atWall.at.y).toBeLessThan(10 * TILE);
  });

  it('wait 30 ticks before the racer that dropped them can collect one', () => {
    const { world, log, player } = quiet();
    world.loosePearls = [looseAt(centreOf(player), 'player')];

    step(world, log, PEARL.ownGraceTicks);
    expect(world.loosePearls).toHaveLength(1);
    expect(eventsIn(log, ...LOOSE_EVENTS)).toEqual([]);

    step(world, log, 1);
    expect(eventsIn(log, ...LOOSE_EVENTS)).toEqual([{ type: 'loosePearl.collected', id: 'player', total: 1 }]);
    expect(player.pearls).toBe(1);
    expect(world.loosePearls).toEqual([]);
  });

  it('go at once to anyone but the dropper, with the pearl boost', () => {
    const { world, log, player } = quiet();
    player.pearls = 3;
    world.loosePearls = [looseAt(centreOf(player), 'tess')];

    step(world, log, 1);

    expect(eventsIn(log, ...LOOSE_EVENTS)).toEqual([{ type: 'loosePearl.collected', id: 'player', total: 4 }]);
    expect(player.pearls).toBe(4);
    // The boost was set this tick and the status counters already took one off.
    expect(player.status.boost).toBe(PEARL.boostTicks - 1);
  });

  it('vanish after 600 ticks when nobody collects them', () => {
    const { world, log } = quiet();
    world.loosePearls = [looseAt(tileCentre(8, 9))];

    step(world, log, PEARL.lifeTicks - 1);
    expect(world.loosePearls).toHaveLength(1);

    step(world, log, 1);
    expect(world.loosePearls).toEqual([]);
    expect(eventsIn(log, ...LOOSE_EVENTS)).toEqual([]);
  });
});
