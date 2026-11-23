import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../events.ts';
import { applyHit } from '../hazards/hits.ts';
import { LOOSE } from '../powerups/tuning.ts';
import { activeRacers, centreOf } from '../racers.ts';
import {
  courseFromLevel,
  eventsIn,
  giveItems,
  hold,
  placeAt,
  placeOnTile,
  raceOn,
  racerOf,
  step,
  tileCentre,
} from '../test-world.ts';
import { type Racer, TILE } from '../types.ts';
import { createWorld } from '../world.ts';
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
    giveItems(player, ['jetFin', { kind: 'puffer', charges: 1 }], 1);
    const centre = centreOf(player);

    applyHit(world, player, 'urchin', null, { x: centre.x - 8, y: centre.y });

    expect(world.loose).toEqual([{ kind: 'puffer', charges: 1, x: centre.x, y: centre.y, grabDelay: 30, ttl: 600 }]);
    expect(eventsIn(log, 'loose.spawned')).toEqual([{ type: 'loose.spawned', kind: 'puffer', charges: 1 }]);
  });
});

describe('grab delay', () => {
  it('keeps even the racer sitting on it from grabbing it for 30 ticks', () => {
    const { world, log } = raceOn(LANES);
    const player = racerOf(world, 'player');
    spawnLoose(world, 'inkSac', 2, centreOf(player));

    step(world, log, 30);
    expect(player.items).toEqual([null, null, null]);
    expect(world.loose).toHaveLength(1);

    step(world, log, 1);
    expect(eventsIn(log, 'loose.grabbed', 'powerup.gained')).toEqual([
      { type: 'loose.grabbed', id: 'player', kind: 'inkSac', charges: 2 },
      { type: 'powerup.gained', id: 'player', kind: 'inkSac', slot: 0, charges: 2 },
    ]);
    expect(player.items).toEqual([{ kind: 'inkSac', charges: 2 }, null, null]);
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
    world.loose = [{ kind: 'jetFin', charges: 1, x: spot.x, y: spot.y, grabDelay: 0, ttl: 600 }];
    return { world, log };
  }

  it('goes to the first racer in order when several touch it at once', () => {
    const { world, log } = crowd();

    updateLoose(world, activeRacers(world), TICK_DT);

    expect(eventsIn(log, 'loose.grabbed')).toEqual([
      { type: 'loose.grabbed', id: 'player', kind: 'jetFin', charges: 1 },
    ]);
    expect(racerOf(world, 'tess').items).toEqual([null, null, null]);
  });

  it('passes over a racer that already holds that kind, and one whose slots are full', () => {
    for (const held of [['jetFin'], ['puffer', 'inkSac', 'mimic']] as const) {
      const { world, log } = crowd();
      giveItems(racerOf(world, 'player'), held);

      updateLoose(world, activeRacers(world), TICK_DT);

      expect(eventsIn(log, 'loose.grabbed'), held.join()).toEqual([
        { type: 'loose.grabbed', id: 'tess', kind: 'jetFin', charges: 1 },
      ]);
      expect(racerOf(world, 'tess').items[0], held.join()).toEqual({ kind: 'jetFin', charges: 1 });
    }
  });

  it('stays loose when everyone touching it holds that kind', () => {
    const { world, log } = crowd();
    giveItems(racerOf(world, 'player'), ['jetFin']);
    giveItems(racerOf(world, 'tess'), ['jetFin']);

    updateLoose(world, activeRacers(world), TICK_DT);

    expect(eventsIn(log)).toEqual([]);
    expect(world.loose).toHaveLength(1);
  });
});

describe('drifting', () => {
  it('rises steadily and disappears after 600 ticks when nobody grabs it', () => {
    const { world, log } = raceOn(BOX);
    const start = tileCentre(8, 3);
    spawnLoose(world, 'glowLantern', 2, start);
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
    world.loose = [{ kind: 'puffer', charges: 2, x: at.x, y: at.y, grabDelay: 0, ttl: 1 }];

    updateLoose(world, activeRacers(world), TICK_DT);

    expect(world.loose).toEqual([]);
    expect(player.items).toEqual([null, null, null]);
    expect(eventsIn(log)).toEqual([]);
  });

  it('rises at 10 px/s', () => {
    const { world } = raceOn(BOX);
    const start = tileCentre(8, 3);
    spawnLoose(world, 'glowLantern', 2, start);

    for (let i = 0; i < 120; i++) updateLoose(world, activeRacers(world), TICK_DT);

    expect(world.loose[0]?.y).toBeCloseTo(start.y - 20, 6);
  });
});

describe('on land', () => {
  /** A floor under row 4 with open air above; the starts sit right of cols 1-2, where the hit happens. */
  const FIELD = `
    ####################
    #..................#
    #..................#
    #..................#
    #....1.2.3.4.....F.#
    ####################
  `;

  /** Puts `racer` standing on the floor with its middle over the middle of column `col`. */
  function standAt(racer: Racer, col: number): void {
    placeOnTile(racer, col, 4);
    racer.body.y = 5 * TILE - racer.body.h;
  }

  it.each([
    ['a ledge', '='],
    ['a crate', '?'],
  ])('rests on %s rather than falling through it', (_what, cell) => {
    // Row 2 holds the platform over columns 6-8; the item drops onto it from row 1.
    const level = `
    ####################
    #..................#
    #.....${cell.repeat(3)}..........#
    #..................#
    #....1.2.3.4.....F.#
    ####################
  `;
    const log = new EventLog<GameEvent>(100_000);
    const world = createWorld(courseFromLevel(level, 'run'), log, { seed: 1 });
    world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
    spawnLoose(world, 'puffer', 1, { x: 7 * TILE + TILE / 2, y: TILE + TILE / 2 });
    step(world, log, LOOSE.grabDelayTicks);

    expect(world.loose.map((item) => Math.floor(item.y / TILE))).toEqual([1]);
  });

  it('settles on the ground under a runner it was knocked off, where another runner beside it grabs it after the delay', () => {
    const log = new EventLog<GameEvent>(100_000);
    const world = createWorld(courseFromLevel(FIELD, 'run'), log, { seed: 1 });
    world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
    const player = racerOf(world, 'player');
    const tess = racerOf(world, 'tess');
    standAt(player, 1);
    standAt(tess, 2);
    step(world, log, 1);
    giveItems(tess, [{ kind: 'puffer', charges: 1 }]);
    const centre = centreOf(tess);
    applyHit(world, tess, 'urchin', null, { x: centre.x - 8, y: centre.y });

    step(world, log, LOOSE.grabDelayTicks);
    expect(world.loose).toHaveLength(1);
    step(world, log, 10, hold({ x: 1, y: 0 }));

    expect(eventsIn(log, 'loose.grabbed')).toEqual([
      { type: 'loose.grabbed', id: 'player', kind: 'puffer', charges: 1 },
    ]);
    expect(player.items[0]).toEqual({ kind: 'puffer', charges: 1 });
  });
});
