import { describe, expect, it } from 'vitest';
import { PEARL } from '../powerups/tuning.ts';
import { activeRacers } from '../racers.ts';
import { eventsIn, giveItems, placeOnTile, raceOn, racerOf } from '../test-world.ts';
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
