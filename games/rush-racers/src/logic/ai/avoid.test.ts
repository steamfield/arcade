/**
 * Rivals steering around hazards (`avoid.ts`, through `rivalIntent`): the flow fields treat urchin
 * and jelly tiles as open water, so the aim bends away from one in the body's path. Whole races on
 * small courses with an idle player, checked through hit events and where the rival ends up.
 */
import { describe, expect, it } from 'vitest';
import { enemyBox } from '../hazards/enemies/contact.ts';
import { SHARK } from '../hazards/enemies/tuning.ts';
import { eventsIn, raceOn, racerOf, step } from '../test-world.ts';
import { type HitCause, type RacerId, TILE, type World } from '../types.ts';
import { enemyDanger } from './avoid.ts';

/** Tess's 5-tall lane has an urchin dead ahead on her start row. */
const URCHIN_AHEAD = `
  ########################
  #1....................F#
  ########################
  #.....................F#
  #.....................F#
  #2.........*..........F#
  #.....................F#
  #.....................F#
  ########################
  #3....................F#
  ########################
  #4....................F#
  ########################
`;

/** A jelly bobs across the middle of Tess's 5-tall lane. */
const JELLY_AHEAD = `
  ########################
  #1....................F#
  ########################
  #.....................F#
  #.....................F#
  #2.........j..........F#
  #.....................F#
  #.....................F#
  ########################
  #3....................F#
  ########################
  #4....................F#
  ########################
`;

/** Squib, the wobbliest rival, threads a two-row line between rows of urchins. */
const URCHIN_TUBE = `
  ########################
  #1....................F#
  ########################
  #2....................F#
  ########################
  ###*.*.*.*.*.*.*.*.*.###
  #3....................F#
  #.....................F#
  ###.*.*.*.*.*.*.*.*.*###
  ########################
  #4....................F#
  ########################
`;

/** A crab on a one-tile rock stump in the middle of Tess's 5-tall lane. */
const CRAB_AHEAD = `
  ########################
  #1....................F#
  ########################
  #.....................F#
  #.....................F#
  #2.........K..........F#
  #..........#..........F#
  #.....................F#
  ########################
  #3....................F#
  ########################
  #4....................F#
  ########################
`;

/** Eels in the ceiling and floor of Tess's 5-tall lane take turns lunging across her start row. */
const EELS_AHEAD = `
  ########################
  #1....................F#
  ########################
  #.....E.......E.......F#
  #.....................F#
  #2....................F#
  #.....................F#
  #.........E.......E...F#
  ########################
  #3....................F#
  ########################
  #4....................F#
  ########################
`;

/** A shark patrols the middle of Tess's 5-tall lane. */
const SHARK_AHEAD = `
  ##################################
  #1..............................F#
  ##################################
  #...............................F#
  #...............................F#
  #2..............S...............F#
  #...............................F#
  #...............................F#
  ##################################
  #3..............................F#
  ##################################
  #4..............................F#
  ##################################
`;

/** Tess's lane is one row tall with a crab on its floor: no way round, so she must deal with it. */
const CRAB_IN_TUBE = `
  ########################
  #1....................F#
  ########################
  #2.........K..........F#
  ########################
  #3....................F#
  ########################
  #4....................F#
  ########################
`;

/** Steps until `id` finishes or 1200 ticks pass; returns its hits by `cause` and whether it finished. */
function raceRival(
  ascii: string,
  id: RacerId,
  seed: number,
  eachTick: (world: World) => void = () => {},
  cause: HitCause = 'urchin',
) {
  const { world, log } = raceOn(ascii, { seed });
  const rival = racerOf(world, id);
  for (let tick = 0; tick < 1200 && rival.finished === null; tick++) {
    eachTick(world);
    step(world, log);
  }
  const hits = eventsIn(log, 'racer.hit').filter((e) => e.type === 'racer.hit' && e.id === id && e.cause === cause);
  return { world, hits: hits.length, finished: rival.finished !== null };
}

describe('rivals and hazards', () => {
  it.each([1, 2, 3, 4, 5])('swims around an urchin dead ahead and finishes untouched (seed %i)', (seed) => {
    expect(raceRival(URCHIN_AHEAD, 'tess', seed)).toMatchObject({ hits: 0, finished: true });
  });

  it.each([1, 2, 3, 4, 5])('threads a lane lined with urchins without touching one (seed %i)', (seed) => {
    expect(raceRival(URCHIN_TUBE, 'squib', seed)).toMatchObject({ hits: 0, finished: true });
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])(
    'swims around a bobbing jelly and finishes untouched (seed %i)',
    (seed) => {
      expect(raceRival(JELLY_AHEAD, 'tess', seed, () => {}, 'jelly')).toMatchObject({ hits: 0, finished: true });
    },
  );

  it('keeps its line through an urchin while inflated, since urchins cannot hurt it then', () => {
    const urchinRowTop = 5 * TILE;
    let crossedUrchinRow = false;
    const { hits, finished } = raceRival(URCHIN_AHEAD, 'tess', 1, (world) => {
      const tess = racerOf(world, 'tess');
      tess.status.inflated = 60;
      const { y, h } = tess.body;
      if (tess.body.x > 10 * TILE && tess.body.x < 12 * TILE && y < urchinRowTop + TILE && y + h > urchinRowTop) {
        crossedUrchinRow = true;
      }
    });
    expect({ hits, finished, crossedUrchinRow }).toEqual({ hits: 0, finished: true, crossedUrchinRow: true });
  });
});

describe('rivals and enemies', () => {
  it.each([1, 2, 3, 4, 5])('swims around a crab and finishes untouched (seed %i)', (seed) => {
    expect(raceRival(CRAB_AHEAD, 'tess', seed, () => {}, 'crab')).toMatchObject({ hits: 0, finished: true });
  });

  it('keeps clear of eels lunging across its line: eight races, every one finished, at most one bite', () => {
    // Without steering round them, every one of these races takes a bite.
    const races = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => raceRival(EELS_AHEAD, 'tess', seed, () => {}, 'eel'));

    expect(races.every((race) => race.finished)).toBe(true);
    expect(races.reduce((sum, race) => sum + race.hits, 0)).toBeLessThanOrEqual(1);
  });

  it.each([1, 2, 3, 4, 5])('gets past a shark, hit no more often than it was charged (seed %i)', (seed) => {
    const { world, log } = raceOn(SHARK_AHEAD, { seed });
    const tess = racerOf(world, 'tess');
    for (let tick = 0; tick < 1200 && tess.finished === null; tick++) step(world, log);
    const charges = eventsIn(log, 'enemy.charged').filter((e) => e.type === 'enemy.charged' && e.target === 'tess');
    const hits = eventsIn(log, 'racer.hit').filter((e) => e.type === 'racer.hit' && e.id === 'tess');

    expect(tess.finished).not.toBeNull();
    expect(hits.length).toBeLessThanOrEqual(charges.length);
  });

  it.each([1, 2, 5])('meets a shark charging at it with a dash, staggering it before it lands (seed %i)', (seed) => {
    const { world, log } = raceOn(SHARK_AHEAD, { seed });
    const tess = racerOf(world, 'tess');
    for (let tick = 0; tick < 1200 && tess.finished === null; tick++) step(world, log);
    const answers = log
      .all()
      .filter(
        (e) =>
          (e.type === 'enemy.charged' && e.target === 'tess') ||
          (e.type === 'enemy.bonked' && e.by === 'tess') ||
          (e.type === 'racer.hit' && e.id === 'tess'),
      )
      .map((e) => e.type);

    expect(answers.slice(0, 2)).toEqual(['enemy.charged', 'enemy.bonked']);
  });

  it('keeps out of the lane a winding-up shark is about to charge down, not just its body', () => {
    const { world } = raceOn(SHARK_AHEAD);
    const shark = world.enemies[0];
    if (!shark) throw new Error('SHARK_AHEAD has a shark');
    shark.mode = 'windup';
    shark.facing = -1;
    const body = enemyBox(shark);
    const danger = enemyDanger(shark);

    expect(danger).toEqual({ ...body, x: body.x - SHARK.chargeSpeed * 0.4, w: body.w + SHARK.chargeSpeed * 0.4 });
  });

  it('dashes into a crab it cannot swim round, beating it instead of taking the hit', () => {
    const { world, log } = raceOn(CRAB_IN_TUBE, { seed: 1 });
    const tess = racerOf(world, 'tess');
    for (let tick = 0; tick < 1200 && tess.finished === null; tick++) step(world, log);

    expect(eventsIn(log, 'enemy.defeated', 'racer.hit')).toEqual([
      { type: 'enemy.defeated', index: 0, kind: 'crab', by: 'tess' },
    ]);
    expect(tess.finished).not.toBeNull();
  });

  it('draws the same numbers from its rng with enemies on the course as without', () => {
    const withCrab = raceOn(CRAB_IN_TUBE, { seed: 4 });
    const without = raceOn(CRAB_IN_TUBE.replace('K', '.'), { seed: 4 });
    step(withCrab.world, withCrab.log, 150);
    step(without.world, without.log, 150);

    expect(eventsIn(withCrab.log, 'enemy.defeated')).toHaveLength(1);
    expect([withCrab, without].map(({ world }) => racerOf(world, 'tess').finished)).toEqual([null, null]);
    expect(withCrab.world.rngs['ai.tess'].state()).toBe(without.world.rngs['ai.tess'].state());
  });
});
