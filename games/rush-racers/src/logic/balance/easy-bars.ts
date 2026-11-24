/**
 * The Easy bars, shared by one stub file per course. Easy promises that a loose-steering child (the
 * novice bot) mostly wins, and that the weakest child (the toddler bot, plus a scripted race where
 * the child stops for 10 s and then holds right) still finishes near the front with rivals that stay
 * in sight. Each bar runs a sample of seeds as Rudy; the full 200 seeds per character is a
 * measurement, not a test. Test-only; nothing in the game imports it.
 */
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { courseOf, DEFAULT_COURSE } from '../courses/index.ts';
import { mediumIdOf } from '../worlds/index.ts';
import { race, slowestRivalRatio, table } from './race-bots.ts';
import { SCRIPT, scriptedRace } from './scripted-race.ts';

const CHARACTER = 'rudy';
const NOVICE_SEEDS = Array.from({ length: 8 }, (_, i) => i + 1);
const TODDLER_SEEDS = Array.from({ length: 9 }, (_, i) => i + 1);
const SCRIPTED_SEEDS = [1, 2, 3];

/** The medium whose racers swim; every other medium's racers run, drift or fly, and the bars say "running". */
const SWIM_MEDIUM = 'swim';

/** How the bars name what the child does in the course's medium. */
interface Wording {
  /** What the rivals do while the child is still. */
  rivalsMove: string;
  /** How the child is described while idle. */
  idle: string;
}

function wordingFor(courseId: string): Wording {
  if (mediumIdOf(courseOf({ course: courseId })) === SWIM_MEDIUM) {
    return { rivalsMove: 'swimming', idle: 'sits still' };
  }
  return { rivalsMove: 'running', idle: 'stands still' };
}

/** The course's name for a describe title: empty for the default course, so its titles stay short. */
function titleSuffix(courseId: string): string {
  return courseId === DEFAULT_COURSE.id ? '' : ` on ${courseOf({ course: courseId }).name}`;
}

/**
 * Registers the Easy bars for a loose-steering child (the novice bot: rare bursts of speed, no
 * items) racing Rudy on the course with `courseId`.
 *
 * @throws {Error} When `courseId` is neither a shipped nor a registered course.
 */
export function describeEasyLevel(courseId: string = DEFAULT_COURSE.id): void {
  describe(`Easy${titleSuffix(courseId)} with a novice bot`, () => {
    const runs = NOVICE_SEEDS.map((seed) => race(BOT_PROFILES.novice, CHARACTER, seed, 'easy', courseId));

    it('wins at least two races in three and places top two in at least 90%', () => {
      const wins = runs.filter((run) => run.playerPlace === 1).length;
      const topTwo = runs.filter((run) => run.playerPlace <= 2).length;
      expect(wins, `novice wins:\n${table(runs)}`).toBeGreaterThanOrEqual(Math.ceil((NOVICE_SEEDS.length * 2) / 3));
      expect(topTwo, `novice top two:\n${table(runs)}`).toBeGreaterThanOrEqual(Math.ceil(NOVICE_SEEDS.length * 0.9));
    });

    it('races visibly: every rival finishes within 1.6x the player time', () => {
      expect(slowestRivalRatio(runs), table(runs)).toBeLessThanOrEqual(1.6);
    });

    it('never has a rival power-up land on the player', () => {
      expect(
        runs.map((run) => run.rivalHitsOnPlayer),
        table(runs),
      ).toEqual(NOVICE_SEEDS.map(() => 0));
    });
  });
}

/**
 * Registers the Easy bars for the weakest child (the toddler bot, then a scripted race with a 10 s
 * pause) racing Rudy on the course with `courseId`: the toddler bot wobbles hard, reacts late and
 * never dashes or uses items, and the scripted race has the child stop for 10 s and then hold right.
 *
 * Measured at v2 phase 4 on Sunlit Shallows, seeds 1-9 as Rudy: the toddler finishes all 9 and places
 * top two in 8; the slowest rival finishes within 1.10x the toddler's time; a median 1 stun a race;
 * no rival power-up lands on it. The scripted races are measured in their own describe.
 *
 * @throws {Error} When `courseId` is neither a shipped nor a registered course.
 */
export function describeEasyToddler(courseId: string = DEFAULT_COURSE.id): void {
  const wording = wordingFor(courseId);
  const suffix = titleSuffix(courseId);

  describe(`Easy${suffix} with a toddler bot`, () => {
    const runs = TODDLER_SEEDS.map((seed) => race(BOT_PROFILES.toddler, CHARACTER, seed, 'easy', courseId));

    it('finishes every race and places top two in at least 70%', () => {
      expect(runs.filter((run) => run.finish.player !== null).length, table(runs)).toBe(TODDLER_SEEDS.length);
      expect(runs.filter((run) => run.playerPlace <= 2).length, table(runs)).toBeGreaterThanOrEqual(
        Math.ceil(TODDLER_SEEDS.length * 0.7),
      );
    });

    it('races visibly: every rival finishes within 1.3x the player time', () => {
      expect(slowestRivalRatio(runs), table(runs)).toBeLessThanOrEqual(1.3);
    });

    it('is stunned by hazards at most 3 times in a typical race', () => {
      const stuns = runs.map((run) => run.playerStuns).sort((a, b) => a - b);
      expect(stuns[Math.floor(stuns.length / 2)], `stuns per race: ${stuns.join(' ')}`).toBeLessThanOrEqual(3);
    });

    it('never has a rival power-up land on the player', () => {
      expect(runs.map((run) => run.rivalHitsOnPlayer)).toEqual(TODDLER_SEEDS.map(() => 0));
    });
  });

  describe(`Easy${suffix} when the child stops for ${SCRIPT.idleTicks / 60} s mid-race and then holds right`, () => {
    const scripted = SCRIPTED_SEEDS.map((seed) => scriptedRace(CHARACTER, seed, 'easy', courseId));

    it(`keeps every rival ${wording.rivalsMove} at a visible pace while the child ${wording.idle}`, () => {
      for (const run of scripted) {
        expect(Math.min(...Object.values(run.rivalSpeedWhileIdle))).toBeGreaterThanOrEqual(25);
      }
    });

    it('lets the child finish and still place top two in at least 2 of 3 races', () => {
      expect(scripted.filter((run) => run.finish.player !== null).length).toBe(scripted.length);
      expect(scripted.filter((run) => run.playerPlace <= 2).length).toBeGreaterThanOrEqual(2);
    });
  });
}
