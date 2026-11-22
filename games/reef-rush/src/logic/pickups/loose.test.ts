import { TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { applyHit } from '../hazards/hits.ts';
import { activeRacers, centreOf } from '../racers.ts';
import { eventsIn, placeAt, raceOn, racerOf, step, tileCentre } from '../test-world.ts';
import { spawnLoose, updateLoose } from './loose.ts';

const LANES = `
  ####################
  #1................F#
  ####################
  #2................F#
  ####################
  #3................F#
  ####################
  #4................F#
  ####################
`;

const BOX = `
  ############
  #1........F#
  #2........F#
  #3........F#
  #4........F#
  ############
`;

describe('a power-up lost to a hit', () => {
  it('floats loose at the racer centre with a 30-tick grab delay and a 600-tick life', () => {
    const { world, log } = raceOn(LANES);
    const player = racerOf(world, 'player');
    player.stack = ['jetFin', 'puffer'];
    const centre = centreOf(player);

    applyHit(world, player, 'urchin', null, { x: centre.x - 8, y: centre.y });

    expect(world.loose).toEqual([{ kind: 'puffer', x: centre.x, y: centre.y, grabDelay: 30, ttl: 600 }]);
    expect(eventsIn(log, 'loose.spawned')).toEqual([{ type: 'loose.spawned', kind: 'puffer' }]);
  });
});

describe('grab delay', () => {
  it('keeps even the racer sitting on it from grabbing it for 30 ticks', () => {
    const { world, log } = raceOn(LANES);
    const player = racerOf(world, 'player');
    spawnLoose(world, 'inkSac', centreOf(player));

    step(world, log, 30);
    expect(player.stack).toEqual([]);
    expect(world.loose).toHaveLength(1);

    step(world, log, 1);
    expect(eventsIn(log, 'loose.grabbed', 'powerup.gained')).toEqual([
      { type: 'loose.grabbed', id: 'player', kind: 'inkSac' },
      { type: 'powerup.gained', id: 'player', kind: 'inkSac' },
    ]);
    expect(player.stack).toEqual(['inkSac']);
    expect(world.loose).toEqual([]);
  });
});

describe('grabbing', () => {
  /** Puts the player and Tess on the same spot with a grabbable loose Jet Fins there. */
  function crowd() {
    const { world, log } = raceOn(BOX);
    const spot = tileCentre(5, 2);
    placeAt(racerOf(world, 'player'), spot);
    placeAt(racerOf(world, 'tess'), spot);
    world.loose = [{ kind: 'jetFin', x: spot.x, y: spot.y, grabDelay: 0, ttl: 600 }];
    return { world, log };
  }

  it('goes to the first racer in order when several touch it at once', () => {
    const { world, log } = crowd();

    updateLoose(world, activeRacers(world), TICK_DT);

    expect(eventsIn(log, 'loose.grabbed')).toEqual([{ type: 'loose.grabbed', id: 'player', kind: 'jetFin' }]);
    expect(racerOf(world, 'tess').stack).toEqual([]);
  });

  it('passes over a racer that already holds that kind', () => {
    const { world, log } = crowd();
    racerOf(world, 'player').stack = ['jetFin'];

    updateLoose(world, activeRacers(world), TICK_DT);

    expect(eventsIn(log, 'loose.grabbed')).toEqual([{ type: 'loose.grabbed', id: 'tess', kind: 'jetFin' }]);
    expect(racerOf(world, 'tess').stack).toEqual(['jetFin']);
  });
});

describe('drifting', () => {
  it('rises steadily and disappears after 600 ticks when nobody grabs it', () => {
    const { world, log } = raceOn(BOX);
    const start = tileCentre(8, 3);
    spawnLoose(world, 'glowLantern', start);
    const racers = activeRacers(world);

    for (let i = 0; i < 599; i++) updateLoose(world, racers, TICK_DT);
    expect(world.loose).toHaveLength(1);
    expect(world.loose[0]?.x).toBeCloseTo(start.x, 6);
    expect(world.loose[0]?.y).toBeLessThan(start.y);

    updateLoose(world, racers, TICK_DT);
    expect(world.loose).toEqual([]);
    expect(eventsIn(log, 'loose.grabbed')).toEqual([]);
  });
});

describe('expiry and drift details', () => {
  it('is gone, not grabbed, when its last tick is the one a racer touches it', () => {
    const { world, log } = raceOn(BOX);
    const player = racerOf(world, 'player');
    const at = centreOf(player);
    world.loose = [{ kind: 'puffer', x: at.x, y: at.y, grabDelay: 0, ttl: 1 }];

    updateLoose(world, activeRacers(world), TICK_DT);

    expect(world.loose).toEqual([]);
    expect(player.stack).toEqual([]);
    expect(eventsIn(log)).toEqual([]);
  });

  it('rises at 10 px/s', () => {
    const { world } = raceOn(BOX);
    const start = tileCentre(8, 3);
    spawnLoose(world, 'glowLantern', start);

    for (let i = 0; i < 120; i++) updateLoose(world, activeRacers(world), TICK_DT);

    expect(world.loose[0]?.y).toBeCloseTo(start.y - 20, 6);
  });
});
