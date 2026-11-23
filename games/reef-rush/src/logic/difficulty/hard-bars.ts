/**
 * The Hard bars, shared by two test files per character in this folder (expert bars, novice bar) so
 * Vitest runs the characters in parallel: an expert bot (rival AI with player physics, dashes and
 * items) and a novice (loose steering, an occasional dash, no items) race 30 seeds each as the
 * character. Bands sit below or around what the tuning measures over many more seeds, so a pass
 * doesn't hang on one lucky seed. Race length is judged against the course's `parTicks`, so the same
 * bars fit a longer or shorter course. The per-seed table prints when a bar is missed.
 *
 * Measured at v2 phase 4 (rivals at par, a metered dash, three clam rolls for rivals), Sunlit
 * Shallows, seeds 1-30 unless said: expert wins 18-26 of 30 per character (60-85% over seeds 1-100:
 * Baron 60, Gil 65, Nib 68, Onyx 72, Rudy 73, Rook 75, Streak 84, Selene 85), and every win but
 * Streak's two by more than 8 s is close; mean expert finish 109.0-115.8 s, 0.96-1.02 of par; the
 * novice places 3rd or 4th in 17-27 of 30 and finishes within 1.3x the winner every time. Test-only.
 */
import { TICK_HZ } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { courseOf, DEFAULT_COURSE } from '../courses/index.ts';
import type { CharacterId } from '../types.ts';
import { meanPlayerFinish, RIVAL_IDS, type Run, race, seconds, table } from './race-bots.ts';

const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);

/**
 * Every character's expert wins (any margin) on the 30 seeds fall in this band. Abilities now
 * spread the cast's win rates over 25 points (see the header), so the band is wide: it catches a
 * character that stops winning or never loses, not a few seeds of spread.
 */
export const BALANCE_BAND = { min: 16, max: 28 } as const;

/** Close expert wins (the lead rival within 8 s) needed of the 30 seeds: measured 18-24. */
const CLOSE_WINS_MIN = 16;

/**
 * A good race's mean expert finish as fractions of the course's par. Per-character means measure
 * 0.96-1.02 of Sunlit's par and five-seed means up to 1.03, so this catches a tuning that moves
 * race length by more than about 9 s.
 */
const PAR_BAND = { min: 0.92, max: 1.08 } as const;

/** Novice 3rd or 4th places needed of the 30 seeds: measured 17 (Selene) to 27. */
const NOVICE_BEHIND_MIN = 15;

/** Novice finishes within 1.3x the winner's time needed of the 30 seeds: measured 30 for every character. */
const NOVICE_IN_TOUCH_MIN = 27;

/** Thirty whole races take a while, more under a loaded test run. */
const RACES_TIMEOUT_MS = 120_000;

/**
 * The mean expert finish, in ticks, that counts as a good race on the course with `courseId`.
 *
 * @throws {Error} When `courseId` is neither a shipped nor a registered course.
 */
export function parBand(courseId: string): { min: number; max: number } {
  const { parTicks } = courseOf({ course: courseId });
  return { min: PAR_BAND.min * parTicks, max: PAR_BAND.max * parTicks };
}

function rivalBest(run: Run): number | null {
  const times = RIVAL_IDS.map((id) => run.finish[id]).filter((t) => t !== null);
  return times.length ? Math.min(...times) : null;
}

/** An expert win that stayed a race: first, with the lead rival in within 8 s. */
function closeWin(run: Run): boolean {
  const player = run.finish.player;
  const rival = rivalBest(run);
  return run.playerPlace === 1 && player !== null && rival !== null && rival - player <= 8 * TICK_HZ;
}

/**
 * Registers the expert bars (wins, balance, race length) for the player racing as `character` on Hard
 * on the course with `courseId`.
 *
 * @throws {Error} When `courseId` is neither a shipped nor a registered course.
 */
export function describeDifficulty(character: CharacterId, courseId: string = DEFAULT_COURSE.id): void {
  const course = courseOf({ course: courseId });
  describe(`difficulty on ${course.name} as ${character}`, () => {
    const expert = (): Run[] => SEEDS.map((seed) => race(BOT_PROFILES.expert, character, seed, 'hard', courseId));

    it(
      `an expert wins at least ${CLOSE_WINS_MIN} of 30 seeds, with the lead rival within 8 s of it`,
      () => {
        const runs = expert();
        expect(runs.filter(closeWin).length, `expert close wins:\n${table(runs)}`).toBeGreaterThanOrEqual(
          CLOSE_WINS_MIN,
        );
      },
      RACES_TIMEOUT_MS,
    );

    it(
      `an expert wins between ${BALANCE_BAND.min} and ${BALANCE_BAND.max} of 30 seeds, like every other character`,
      () => {
        const runs = expert();
        const wins = runs.filter((run) => run.playerPlace === 1).length;
        expect(wins, `expert wins:\n${table(runs)}`).toBeGreaterThanOrEqual(BALANCE_BAND.min);
        expect(wins, `expert wins:\n${table(runs)}`).toBeLessThanOrEqual(BALANCE_BAND.max);
      },
      RACES_TIMEOUT_MS,
    );

    it(
      `a good race takes about ${seconds(course.parTicks)} s, the course's par`,
      () => {
        const runs = expert();
        const finished = runs.filter((run) => run.finish.player !== null).length;
        expect(finished, `expert finished every seed:\n${table(runs)}`).toBe(SEEDS.length);
        const mean = meanPlayerFinish(runs, courseId);
        const band = parBand(courseId);
        expect(mean, `mean expert finish ${seconds(mean)} s:\n${table(runs)}`).toBeGreaterThan(band.min);
        expect(mean, `mean expert finish ${seconds(mean)} s:\n${table(runs)}`).toBeLessThan(band.max);
      },
      RACES_TIMEOUT_MS,
    );
  });
}

/**
 * Registers the novice bar for the player racing as `character` on Hard on the course with
 * `courseId`, in a file of its own so it runs beside the expert bars.
 *
 * @throws {Error} When `courseId` is neither a shipped nor a registered course.
 */
export function describeNovice(character: CharacterId, courseId: string = DEFAULT_COURSE.id): void {
  const course = courseOf({ course: courseId });
  describe(`novice on ${course.name} as ${character}`, () => {
    it(
      `a novice places 3rd or 4th in at least ${NOVICE_BEHIND_MIN} seeds and finishes within 1.3x the winner time`,
      () => {
        const runs = SEEDS.map((seed) => race(BOT_PROFILES.novice, character, seed, 'hard', courseId));
        const behind = runs.filter((run) => run.playerPlace >= 3);
        expect(behind.length, `novice placed 3rd or 4th:\n${table(runs)}`).toBeGreaterThanOrEqual(NOVICE_BEHIND_MIN);
        const inTouch = runs.filter((run) => {
          const player = run.finish.player;
          const times = Object.values(run.finish).filter((t) => t !== null);
          return player !== null && player <= 1.3 * Math.min(...times);
        });
        expect(inTouch.length, `novice finished within 1.3x the winner time:\n${table(runs)}`).toBeGreaterThanOrEqual(
          NOVICE_IN_TOUCH_MIN,
        );
      },
      RACES_TIMEOUT_MS,
    );
  });
}
