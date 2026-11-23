/**
 * A fast stand-in for the 30-seed difficulty bars, so `arcade check` notices a broken race without
 * running the `difficulty` project: on Sunlit Shallows on Hard, over five seeds and two characters,
 * the expert and the novice finish, the expert wins most races and its mean finish sits in the par
 * band the full bars use.
 */
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../../ai/profiles.ts';
import { DEFAULT_COURSE } from '../../courses/index.ts';
import type { CharacterId } from '../../types.ts';
import { meanPlayerFinish, parBand, race, seconds, table } from '../race-bots.ts';

const SEEDS = [1, 2, 3, 4, 5];
/** The default character and Onyx, whose expert wins the fewest Hard races over seeds 1-200. */
const CHARACTERS: CharacterId[] = ['rudy', 'onyx'];
const EXPERT_MIN_WINS = 3;
/** Ten whole races per character, with room for a loaded machine. */
const RACES_TIMEOUT_MS = 60_000;

describe.each(CHARACTERS)(`the sanity bar on ${DEFAULT_COURSE.name} on Hard as %s`, (character) => {
  const expertRuns = () => SEEDS.map((seed) => race(BOT_PROFILES.expert, character, seed));
  const noviceRuns = () => SEEDS.map((seed) => race(BOT_PROFILES.novice, character, seed));

  it(
    `lets an expert finish every race, win at least ${EXPERT_MIN_WINS} of ${SEEDS.length} and finish near par on average`,
    () => {
      const runs = expertRuns();
      const mean = meanPlayerFinish(runs);
      const band = parBand(DEFAULT_COURSE.id);

      expect(
        runs.filter((run) => run.finish.player === null),
        table(runs),
      ).toEqual([]);
      expect(runs.filter((run) => run.playerPlace === 1).length, table(runs)).toBeGreaterThanOrEqual(EXPERT_MIN_WINS);
      expect(mean, `mean expert finish ${seconds(mean)} s:\n${table(runs)}`).toBeGreaterThan(band.min);
      expect(mean, `mean expert finish ${seconds(mean)} s:\n${table(runs)}`).toBeLessThan(band.max);
    },
    RACES_TIMEOUT_MS,
  );

  it(
    'lets a novice finish every race',
    () => {
      const runs = noviceRuns();

      expect(
        runs.filter((run) => run.finish.player === null),
        table(runs),
      ).toEqual([]);
    },
    RACES_TIMEOUT_MS,
  );
});
