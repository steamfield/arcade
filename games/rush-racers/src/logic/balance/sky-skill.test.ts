/**
 * Skill shows in the sky: on sky-test on Hard, the expert bot (reading ring lines, bounce clouds and
 * storm warnings, passing cleanly) beats the novice bot as the same character on the same seed in
 * nearly every pair, and by a clear margin on average. 40 seeds x 8 characters, raced through
 * `race` (`race-bots.ts`).
 */
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { RACE_LIMIT_TICKS } from '../race/standings.ts';
import { CHARACTER_IDS } from '../types.ts';
import { race, seconds } from './race-bots.ts';

/** The course under test. */
const COURSE_ID = 'sky-test';
/** Seeds raced per character. */
const SEEDS = Array.from({ length: 40 }, (_, index) => index + 1);
/** Least share of pairs in which the expert finishes ahead of the novice. */
const EXPERT_AHEAD_MIN = 0.85;
/** Most the expert's mean finish may be, as a share of the novice's. */
const MEAN_RATIO_MAX = 0.9;
/** 640 whole races. */
const RACES_TIMEOUT_MS = 600_000;

/** One seed and character raced by both bots: each one's finish tick (null when it never finished). */
interface Pair {
  character: string;
  seed: number;
  expert: number | null;
  novice: number | null;
}

/** Every pair, both bots racing each character on each seed. */
function pairs(): Pair[] {
  return CHARACTER_IDS.flatMap((character) =>
    SEEDS.map((seed) => ({
      character,
      seed,
      expert: race(BOT_PROFILES.expert, character, seed, 'hard', COURSE_ID).finish.player,
      novice: race(BOT_PROFILES.novice, character, seed, 'hard', COURSE_ID).finish.player,
    })),
  );
}

/** Whether the expert finished and the novice didn't, or finished later. */
const expertAhead = (pair: Pair) => pair.expert !== null && (pair.novice === null || pair.expert < pair.novice);

/** Mean finish tick, a race never finished counting as the race's time limit. */
function mean(ticks: readonly (number | null)[]): number {
  return ticks.reduce<number>((sum, tick) => sum + (tick ?? RACE_LIMIT_TICKS), 0) / ticks.length;
}

/** The pairs the expert didn't win, one line each, for the failure message. */
function lost(all: readonly Pair[]): string {
  return all
    .filter((pair) => !expertAhead(pair))
    .map(
      (pair) =>
        `${pair.character} seed ${pair.seed}: expert ${seconds(pair.expert)} s, novice ${seconds(pair.novice)} s`,
    )
    .join('\n');
}

describe('skill on sky-test (Hard)', () => {
  it(
    `the expert finishes ahead of the novice in at least ${EXPERT_AHEAD_MIN * 100} % of pairs, with a mean at least ${Math.round((1 - MEAN_RATIO_MAX) * 100)} % lower`,
    () => {
      const all = pairs();
      const expertMean = mean(all.map((pair) => pair.expert));
      const noviceMean = mean(all.map((pair) => pair.novice));
      const ahead = all.filter(expertAhead).length / all.length;
      const summary = `expert mean ${seconds(expertMean)} s, novice mean ${seconds(noviceMean)} s, expert ahead ${(ahead * 100).toFixed(1)} %`;

      expect(ahead, `${summary}\nnot ahead:\n${lost(all)}`).toBeGreaterThanOrEqual(EXPERT_AHEAD_MIN);
      expect(expertMean, summary).toBeLessThanOrEqual(MEAN_RATIO_MAX * noviceMean);
    },
    RACES_TIMEOUT_MS,
  );
});
