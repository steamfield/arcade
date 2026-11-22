/**
 * Rivals steering around hazards (`avoid.ts`, through `rivalIntent`): the flow fields treat urchin
 * and jelly tiles as open water, so the aim bends away from one in the body's path. Whole races on
 * small courses with an idle player, checked through hit events and where the rival ends up.
 */
import { describe, expect, it } from 'vitest';
import { eventsIn, raceOn, racerOf, step } from '../test-world.ts';
import { type RacerId, TILE, type World } from '../types.ts';

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

/** Steps until `id` finishes or 1200 ticks pass; returns its hits by `cause` and whether it finished. */
function raceRival(
  ascii: string,
  id: RacerId,
  seed: number,
  eachTick: (world: World) => void = () => {},
  cause: 'urchin' | 'jelly' = 'urchin',
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

  it.each([1, 2, 3, 4, 5])('swims around a bobbing jelly and finishes untouched (seed %i)', (seed) => {
    expect(raceRival(JELLY_AHEAD, 'tess', seed, () => {}, 'jelly')).toMatchObject({ hits: 0, finished: true });
  });

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
