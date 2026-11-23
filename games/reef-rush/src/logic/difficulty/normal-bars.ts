/**
 * The Normal bars, shared by one test file per character so Vitest runs them in parallel. Normal
 * promises three things: a player who swims well but never dashes or fires (the no-dash bot) stays
 * in the race; skill still pays, so the expert bot (dashes and items) wins clearly more often than
 * that player on the same seeds; and a casual player (the novice bot: loose steering, an occasional
 * dash, no items) finishes and is in the mix without winning nearly every race.
 *
 * Measured at v2 phase 4 on Sunlit Shallows, seeds 1-10 per character: the no-dash bot places top 3
 * in 9-10 and wins 1-4; the expert wins 9-10, 5 (Gil) to 9 (Selene, Rook) more than the no-dash
 * bot; the novice finishes all 10, places top 3 in 6 (Nib) to 10 (Streak) and wins 0 (Gil) to 6
 * (Selene). Test-only; nothing in the game imports it.
 */
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { courseOf, DEFAULT_COURSE } from '../courses/index.ts';
import type { CharacterId } from '../types.ts';
import { type Run, race, table } from './race-bots.ts';

const SEEDS = Array.from({ length: 10 }, (_, i) => i + 1);

/** Top-3 places the no-dash bot needs of the seeds: at least 60%. */
const NO_DASH_TOP_THREE_MIN = Math.ceil(SEEDS.length * 0.6);

/** Wins the expert needs over the no-dash bot's on the same seeds: 4 of 10, 40 points. */
const EXPERT_WIN_MARGIN = 4;

/** Novice top-3 places needed of the seeds: measured 6-10. */
const NOVICE_TOP_THREE_MIN = 5;

/** The most races the novice may win: measured 0-6. More means Normal stopped asking anything. */
const NOVICE_WINS_MAX = 8;

/** Thirty whole races, with room for a loaded machine. */
const RACES_TIMEOUT_MS = 120_000;

const wins = (runs: Run[]) => runs.filter((run) => run.playerPlace === 1).length;
const topThree = (runs: Run[]) => runs.filter((run) => run.playerPlace <= 3).length;

/**
 * Registers the Normal bars for the player racing as `character` on the course with `courseId`.
 *
 * @throws {Error} When `courseId` is neither a shipped nor a registered course.
 */
export function describeNormal(character: CharacterId, courseId: string = DEFAULT_COURSE.id): void {
  describe(`Normal on ${courseOf({ course: courseId }).name} as ${character}`, () => {
    const noDash = (): Run[] => SEEDS.map((seed) => race(BOT_PROFILES.noDash, character, seed, 'normal', courseId));
    const expert = (): Run[] => SEEDS.map((seed) => race(BOT_PROFILES.expert, character, seed, 'normal', courseId));

    it(
      `lets a player who never dashes or fires place top 3 in at least ${NO_DASH_TOP_THREE_MIN} of ${SEEDS.length} races`,
      () => {
        const runs = noDash();
        expect(runs.map((run) => run.playerActions)).toEqual(runs.map(() => ({ dashes: 0, uses: 0 })));
        expect(topThree(runs), `no-dash top 3:\n${table(runs)}`).toBeGreaterThanOrEqual(NO_DASH_TOP_THREE_MIN);
      },
      RACES_TIMEOUT_MS,
    );

    it(
      `lets an expert who dashes and fires win at least ${EXPERT_WIN_MARGIN} more of ${SEEDS.length} races than that player`,
      () => {
        const plain = noDash();
        const skilled = expert();
        expect(
          wins(skilled),
          `expert wins:\n${table(skilled)}\nno-dash wins (${wins(plain)}):\n${table(plain)}`,
        ).toBeGreaterThanOrEqual(wins(plain) + EXPERT_WIN_MARGIN);
      },
      RACES_TIMEOUT_MS,
    );

    it(
      `lets a novice finish every race, place top 3 in at least ${NOVICE_TOP_THREE_MIN} and win at most ${NOVICE_WINS_MAX} of ${SEEDS.length}`,
      () => {
        const runs = SEEDS.map((seed) => race(BOT_PROFILES.novice, character, seed, 'normal', courseId));
        expect(
          runs.filter((run) => run.finish.player === null),
          table(runs),
        ).toEqual([]);
        expect(topThree(runs), `novice top 3:\n${table(runs)}`).toBeGreaterThanOrEqual(NOVICE_TOP_THREE_MIN);
        expect(wins(runs), `novice wins:\n${table(runs)}`).toBeLessThanOrEqual(NOVICE_WINS_MAX);
      },
      RACES_TIMEOUT_MS,
    );
  });
}
