/**
 * A fast stand-in for the 30-seed difficulty bars, so `arcade check` notices a broken race without
 * running the `difficulty` project: on Sunlit Shallows on Hard, over five seeds and two characters,
 * the expert and the novice finish, the expert wins some races and its mean finish sits in the par
 * band. Measured at v2 phase 4: the expert wins 2 (Rudy) and 4 (Onyx) of the 5, with mean finishes
 * of 1.033 and 1.025 of par.
 */
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../../ai/profiles.ts';
import { DEFAULT_COURSE } from '../../courses/index.ts';
import type { CharacterId } from '../../types.ts';
import { parBand } from '../hard-bars.ts';
import { meanPlayerFinish, race, seconds, table } from '../race-bots.ts';

const SEEDS = [1, 2, 3, 4, 5];
/** The default character and Onyx, v1's weakest Hard expert (in v2 Baron's is, at 60% over seeds 1-100). */
const CHARACTERS: CharacterId[] = ['rudy', 'onyx'];
const EXPERT_MIN_WINS = 2;
/** Ten whole races per character, with room for a loaded machine. */
const RACES_TIMEOUT_MS = 60_000;

describe.each(CHARACTERS)(`the sanity bar on ${DEFAULT_COURSE.name} on Hard as %s`, (character) => {
  const expertRuns = () => SEEDS.map((seed) => race(BOT_PROFILES.expert, character, seed));
  const noviceRuns = () => SEEDS.map((seed) => race(BOT_PROFILES.novice, character, seed));

  it(
    `lets an expert finish every race near par and win at least ${EXPERT_MIN_WINS} of ${SEEDS.length}`,
    () => {
      const runs = expertRuns();

      expect(
        runs.filter((run) => run.finish.player === null),
        table(runs),
      ).toEqual([]);
      expect(runs.filter((run) => run.playerPlace === 1).length, table(runs)).toBeGreaterThanOrEqual(EXPERT_MIN_WINS);
      const mean = meanPlayerFinish(runs, DEFAULT_COURSE.id);
      const band = parBand(DEFAULT_COURSE.id);
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
