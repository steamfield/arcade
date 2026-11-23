/**
 * The difficulty bars, shared by two test files per character in this folder (expert bars, novice bar) so Vitest runs the
 * characters in parallel. Bots drive the player's racer through whole races on a real course (Sunlit
 * Shallows unless a course id is given): an expert (rival AI with player physics, full kicks and
 * items) and a novice (loose steering, an occasional kick, no items). The player races as the
 * character, ability included, against the rivals that pick draws. Every racer races to the line so
 * each gap is a real time. Thirty seeds per character, with bars set below the rates the tuning
 * reaches over many more, so a pass doesn't hang on one lucky seed. Race length is judged against the
 * course's `parTicks`, so the same bars fit a longer or shorter course. Results go into assertion
 * messages; the per-seed table prints when a bar is missed. Test-only; nothing in the game imports it.
 */
import { EventLog, TICK_DT, TICK_HZ } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { COURSES, courseOf, DEFAULT_COURSE } from '../courses/index.ts';
import type { GameEvent } from '../events.ts';
import { RACE_LIMIT_TICKS } from '../race/standings.ts';
import type { CharacterId, Difficulty, RacerId, RivalProfile, World } from '../types.ts';
import { createWorld, stepWorld } from '../world.ts';

const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);
const IDLE = { move: { x: 0, y: 0 }, kick: false, burst: false };

/**
 * Balance across the cast: every character's expert wins (any margin) on the 30 seeds fall in this
 * band, so no character wins more than 4 seeds (about 13 points) more than another. A fixed band
 * lets each character's file check it from its own races; the tuning measures 82.5-88.5% plain wins
 * (81.5-88% close wins) for every character over seeds 1-200, inside the band with room on both sides.
 */
export const BALANCE_BAND = { min: 24, max: 28 } as const;

/**
 * A good race's mean expert finish as fractions of the course's par: Sunlit's 75-105 s band divided
 * by Sunlit's par, so every course gets the same room around its own par.
 */
const PAR_BAND = {
  min: (75 * TICK_HZ) / COURSES['sunlit-shallows'].parTicks,
  max: (105 * TICK_HZ) / COURSES['sunlit-shallows'].parTicks,
} as const;

/** Thirty whole races take a while, more under a loaded test run. */
const RACES_TIMEOUT_MS = 120_000;

/** What one whole race reports. */
export interface Run {
  seed: number;
  /** Finish tick per racer, null when it never finished. */
  finish: Record<RacerId, number | null>;
  playerPlace: number;
  /** Hits and squid latches that landed on the player, caused by a rival's power-up. */
  rivalHitsOnPlayer: number;
  /** Times the player was stunned. */
  playerStuns: number;
  /**
   * Per racer, the longest stretch of racing ticks, free of stuns and traps, without a new best
   * (lowest) progress before it finished.
   */
  longestStall: Record<RacerId, number>;
}

/** One racer's stall count: its best progress so far, ticks since it improved, and the longest such stretch. */
interface StallCount {
  best: number;
  since: number;
  longest: number;
}

/**
 * The mean expert finish, in ticks, that counts as a good race on the course with `courseId`.
 *
 * @throws {Error} When `courseId` is neither a shipped nor a registered course.
 */
export function parBand(courseId: string): { min: number; max: number } {
  const { parTicks } = courseOf({ course: courseId });
  return { min: PAR_BAND.min * parTicks, max: PAR_BAND.max * parTicks };
}

/**
 * Runs already raced in this file, by bot profile object and then by course, character, seed and
 * level. Keyed on the profile object because every bot profile carries the player's racer id.
 */
const raced = new WeakMap<RivalProfile, Map<string, Run>>();

/**
 * One whole race with `bot` driving the player's racer as `character`, on `difficulty` and the
 * course with `courseId`. Raced once per test file; asking again returns the same run.
 *
 * @throws {Error} When `courseId` is neither a shipped nor a registered course.
 */
export function race(
  bot: RivalProfile,
  character: CharacterId,
  seed: number,
  difficulty: Difficulty = 'hard',
  courseId: string = DEFAULT_COURSE.id,
): Run {
  const byBot = raced.get(bot) ?? new Map<string, Run>();
  raced.set(bot, byBot);
  const key = `${courseId}/${character}/${seed}/${difficulty}`;
  const known = byBot.get(key);
  if (known) return known;
  const run = raceOnce(bot, character, seed, difficulty, courseId);
  byBot.set(key, run);
  return run;
}

/** Races once, unmemoised: see `race`. */
function raceOnce(
  bot: RivalProfile,
  character: CharacterId,
  seed: number,
  difficulty: Difficulty,
  courseId: string,
): Run {
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(courseOf({ course: courseId }), log, {
    seed,
    difficulty,
    playerBot: bot,
    endsWhen: 'everyone',
    character,
  });
  const stalls = new Map<RacerId, StallCount>(
    world.racers.map((racer) => [racer.id, { best: Number.POSITIVE_INFINITY, since: 0, longest: 0 }]),
  );
  // Countdown plus the race limit, with room to spare; the race ends itself well before this.
  for (let i = 0; i < RACE_LIMIT_TICKS + 1000 && world.race.phase !== 'finished'; i++) {
    stepWorld(world, IDLE, TICK_DT);
    countStalls(world, stalls);
  }
  const finish = Object.fromEntries(world.racers.map((r) => [r.id, r.finished?.tick ?? null])) as Run['finish'];
  const longestStall = Object.fromEntries([...stalls].map(([id, count]) => [id, count.longest])) as Run['longestStall'];
  const events = log.all();
  const rivalHitsOnPlayer = events.filter(
    (event) =>
      (event.type === 'racer.hit' && event.id === 'player' && event.by !== null && event.by !== 'player') ||
      (event.type === 'squid.latched' && event.id === 'player' && event.by !== 'player'),
  ).length;
  const playerStuns = events.filter((event) => event.type === 'racer.stunned' && event.id === 'player').length;
  const playerPlace = world.race.result?.playerPlace ?? 4;
  return { seed, finish, playerPlace, rivalHitsOnPlayer, playerStuns, longestStall };
}

/**
 * Advances each unfinished racer's stall count by one tick, while the race is on. A stun or trap
 * restarts the count, as it does the rivals' own progress backstop: a racer a hazard holds still
 * isn't stuck on the course's geometry.
 */
function countStalls(world: World, stalls: Map<RacerId, StallCount>): void {
  if (world.race.phase !== 'racing') return;
  for (const racer of world.racers) {
    const count = stalls.get(racer.id);
    if (!count || racer.finished) continue;
    if (racer.status.stunned > 0 || racer.status.trapped > 0) {
      count.since = 0;
      continue;
    }
    if (racer.progress < count.best) {
      count.best = racer.progress;
      count.since = 0;
      continue;
    }
    count.since++;
    count.longest = Math.max(count.longest, count.since);
  }
}

/** A finish tick in seconds, or 'DNF'. */
export const seconds = (ticks: number | null) => (ticks === null ? 'DNF' : (ticks / TICK_HZ).toFixed(1));

/** The per-seed table of places and finish times that assertion messages print. */
export function table(runs: Run[]): string {
  return runs
    .map(({ seed, finish, playerPlace }) => {
      const times = Object.entries(finish).map(([id, t]) => `${id} ${seconds(t)}`);
      return `seed ${seed}: place ${playerPlace}; ${times.join(', ')}`;
    })
    .join('\n');
}

/**
 * The mean player finish over the runs it finished, in ticks. `courseId` names the course in the error.
 *
 * @throws {Error} When the player finished none of the runs, so there is no mean to judge.
 */
export function meanPlayerFinish(runs: Run[], courseId: string): number {
  const times = runs.map((run) => run.finish.player).filter((t) => t !== null);
  if (times.length === 0) {
    throw new Error(`The player finished none of ${runs.length} runs on '${courseId}', so it has no mean finish`);
  }
  return times.reduce((sum, t) => sum + t, 0) / times.length;
}

/** The largest rival finish time over the player's, across runs; Infinity when anyone failed to finish. */
export function slowestRivalRatio(runs: Run[]): number {
  let worst = 0;
  for (const run of runs) {
    for (const id of ['tess', 'squib', 'bo'] as const) {
      const rival = run.finish[id];
      const player = run.finish.player;
      if (rival === null || player === null) return Number.POSITIVE_INFINITY;
      worst = Math.max(worst, rival / player);
    }
  }
  return worst;
}

function rivalBest(run: Run): number | null {
  const times = (['tess', 'squib', 'bo'] as const).map((id) => run.finish[id]).filter((t) => t !== null);
  return times.length ? Math.min(...times) : null;
}

/** An expert win that stayed a race: first, with the lead rival in within 8 s. */
function closeWin(run: Run): boolean {
  const player = run.finish.player;
  const rival = rivalBest(run);
  return run.playerPlace === 1 && player !== null && rival !== null && rival - player <= 8 * TICK_HZ;
}

/**
 * Registers the expert bars (wins, balance, race length) for the player racing as `character` on the
 * course with `courseId`.
 *
 * @throws {Error} When `courseId` is neither a shipped nor a registered course.
 */
export function describeDifficulty(character: CharacterId, courseId: string = DEFAULT_COURSE.id): void {
  const course = courseOf({ course: courseId });
  describe(`difficulty on ${course.name} as ${character}`, () => {
    const expert = (): Run[] => SEEDS.map((seed) => race(BOT_PROFILES.expert, character, seed, 'hard', courseId));

    it(
      'an expert wins at least 21 of 30 seeds, with the lead rival within 8 s of it',
      () => {
        const runs = expert();
        expect(runs.filter(closeWin).length, `expert close wins:\n${table(runs)}`).toBeGreaterThanOrEqual(21);
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
 * Registers the novice bar for the player racing as `character` on the course with `courseId`, in a
 * file of its own so it runs beside the expert bars.
 *
 * @throws {Error} When `courseId` is neither a shipped nor a registered course.
 */
export function describeNovice(character: CharacterId, courseId: string = DEFAULT_COURSE.id): void {
  const course = courseOf({ course: courseId });
  describe(`novice on ${course.name} as ${character}`, () => {
    it(
      'a novice places 3rd or 4th in most seeds and finishes within 1.3x the winner time',
      () => {
        const runs = SEEDS.map((seed) => race(BOT_PROFILES.novice, character, seed, 'hard', courseId));
        const behind = runs.filter((run) => run.playerPlace >= 3);
        expect(behind.length, `novice placed 3rd or 4th:\n${table(runs)}`).toBeGreaterThanOrEqual(21);
        const inTouch = runs.filter((run) => {
          const player = run.finish.player;
          const times = Object.values(run.finish).filter((t) => t !== null);
          return player !== null && player <= 1.3 * Math.min(...times);
        });
        expect(inTouch.length, `novice finished within 1.3x the winner time:\n${table(runs)}`).toBeGreaterThanOrEqual(
          24,
        );
      },
      RACES_TIMEOUT_MS,
    );
  });
}
