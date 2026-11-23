/**
 * A fast stand-in for the 30-seed difficulty bars, so `arcade check` notices a broken race without
 * running the `difficulty` project: on Sunlit Shallows on Hard, over five seeds and two characters,
 * the expert and the novice finish and the expert wins most races. The par band left this bar in v2
 * phase 2 (rivals at par, a metered dash): phase 4 sets the new par and puts the check back.
 */
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../../ai/profiles.ts';
import { DEFAULT_COURSE } from '../../courses/index.ts';
import type { CharacterId } from '../../types.ts';
import { race, table } from '../race-bots.ts';

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
    `lets an expert finish every race and win at least ${EXPERT_MIN_WINS} of ${SEEDS.length}`,
    () => {
      const runs = expertRuns();

      expect(
        runs.filter((run) => run.finish.player === null),
        table(runs),
      ).toEqual([]);
      expect(runs.filter((run) => run.playerPlace === 1).length, table(runs)).toBeGreaterThanOrEqual(EXPERT_MIN_WINS);
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
