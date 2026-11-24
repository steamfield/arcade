/**
 * The Hard bars, shared by two test files per character in this folder (expert bars, novice bar) so
 * Vitest runs the characters in parallel: an expert bot (rival AI with player physics, dashes and
 * items) and a novice (loose steering, an occasional dash, no items) race 30 seeds each as the
 * character. Bands sit below or around what the tuning measures over many more seeds, so a pass
 * doesn't hang on one lucky seed. Race length is judged against the course's `parTicks`, so the same
 * bars fit a longer or shorter course. The per-seed table prints when a bar is missed.
 *
 * Measured at v2 phase 4 (rivals at par, a metered dash, two clam rolls for rivals), Sunlit
 * Shallows, seeds 1-30 unless said: expert wins 21-27 of 30 per character, close wins (lead rival
 * within 8 s, now CLOSE_WIN_PAR_SHARE of par) 21-27; mean expert finish 106.9-115.0 s, 0.95-1.03 of par; the novice places 3rd or
 * 4th in 21-28 of 30 and finishes within 1.3x the winner every time. Test-only.
 *
 * Open balance problem: the cast's expert win rates are no longer within a few points of each other.
 * Over seeds 1-100: Baron 67%, Gil 73, Rook 75, Nib 76, Onyx 77, Rudy 85, Streak 89, Selene 91, a
 * 24-point spread (v1 kept it to 6). Abilities, not rival profiles, drive it, so these bars check
 * that every character's expert wins most races and leave balance to an ability retune.
 */
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { courseOf, DEFAULT_COURSE } from '../courses/index.ts';
import type { CharacterId } from '../types.ts';
import { meanPlayerFinish, parBand, RIVAL_IDS, type Run, race, racesTimeoutMs, seconds, table } from './race-bots.ts';

const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);

/**
 * Expert wins (any margin) every character needs of the 30 seeds: measured 21-27 at v2 phase 4.
 * Not a balance check (see the header): it catches a character whose expert stops winning most
 * races. Lowered from 18 when the course gained its surface section, cave and hunting sharks on
 * purpose, which took Nib's expert to 17.
 */
const EXPERT_WINS_MIN = 17;

/**
 * Close expert wins (the lead rival within CLOSE_WIN_PAR_SHARE of par) needed of the 30 seeds: measured 21-27 at v2 phase
 * 4; lowered from 18 with the harder course, which took Nib's expert to 16.
 */
const CLOSE_WINS_MIN = 16;

/**
 * How close the lead rival must finish for an expert win to count as close, as a share of the
 * course's par: 8 s of Sunlit's 111 s par at v2 phase 4, so about 11 s on a 152 s course.
 */
const CLOSE_WIN_PAR_SHARE = 0.072;

/** Novice 3rd or 4th places needed of the 30 seeds: measured 21 (Selene) to 28. */
const NOVICE_BEHIND_MIN = 18;

/** Novice finishes within 1.3x the winner's time needed of the 30 seeds: measured 30 for every character. */
const NOVICE_IN_TOUCH_MIN = 27;

/** Each test races at most the 30 seeds once (`race` memoises across the expert's three). */
const RACES_TIMEOUT_MS = racesTimeoutMs(SEEDS.length);

function rivalBest(run: Run): number | null {
  const times = RIVAL_IDS.map((id) => run.finish[id]).filter((t) => t !== null);
  return times.length ? Math.min(...times) : null;
}

/** The close-win window on a course with `parTicks`, in ticks. */
function closeWindowTicks(parTicks: number): number {
  return Math.round(parTicks * CLOSE_WIN_PAR_SHARE);
}

/** An expert win that stayed a race: first, with the lead rival in within `windowTicks`. */
function closeWin(run: Run, windowTicks: number): boolean {
  const player = run.finish.player;
  const rival = rivalBest(run);
  return run.playerPlace === 1 && player !== null && rival !== null && rival - player <= windowTicks;
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
    const closeTicks = closeWindowTicks(course.parTicks);

    it(
      `an expert wins at least ${CLOSE_WINS_MIN} of 30 seeds, with the lead rival within ${seconds(closeTicks)} s of it`,
      () => {
        const runs = expert();
        expect(
          runs.filter((run) => closeWin(run, closeTicks)).length,
          `expert close wins:\n${table(runs)}`,
        ).toBeGreaterThanOrEqual(CLOSE_WINS_MIN);
      },
      RACES_TIMEOUT_MS,
    );

    it(
      `an expert wins most races: at least ${EXPERT_WINS_MIN} of 30 seeds`,
      () => {
        const runs = expert();
        const wins = runs.filter((run) => run.playerPlace === 1).length;
        expect(wins, `expert wins:\n${table(runs)}`).toBeGreaterThanOrEqual(EXPERT_WINS_MIN);
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
