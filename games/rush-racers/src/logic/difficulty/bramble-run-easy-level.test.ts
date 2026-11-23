/**
 * The Easy bars on Bramble Run for a loose-steering child (the novice bot: rare dashes, no items),
 * the same bars `easy-level.test.ts` sets on Sunlit Shallows, on a sample of seeds as Rudy.
 */
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { race, slowestRivalRatio, table } from './race-bots.ts';

const COURSE_ID = 'bramble-run';
const SEEDS = Array.from({ length: 8 }, (_, i) => i + 1);

describe('Easy on Bramble Run with a novice bot', () => {
  const runs = SEEDS.map((seed) => race(BOT_PROFILES.novice, 'rudy', seed, 'easy', COURSE_ID));

  it('wins at least two races in three and places top two in at least 90%', () => {
    const wins = runs.filter((run) => run.playerPlace === 1).length;
    const topTwo = runs.filter((run) => run.playerPlace <= 2).length;
    expect(wins, `novice wins:\n${table(runs)}`).toBeGreaterThanOrEqual(Math.ceil((SEEDS.length * 2) / 3));
    expect(topTwo, `novice top two:\n${table(runs)}`).toBeGreaterThanOrEqual(Math.ceil(SEEDS.length * 0.9));
  });

  it('races visibly: every rival finishes within 1.6x the player time', () => {
    expect(slowestRivalRatio(runs), table(runs)).toBeLessThanOrEqual(1.6);
  });

  it('never has a rival power-up land on the player', () => {
    expect(
      runs.map((run) => run.rivalHitsOnPlayer),
      table(runs),
    ).toEqual(SEEDS.map(() => 0));
  });
});
