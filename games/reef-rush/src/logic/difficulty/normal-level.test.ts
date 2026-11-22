/**
 * The Normal bars: a casual adult (the novice bot) wins about a third of races and places top two in
 * most; an expert wins nearly all. A sample of seeds on one character (the full 200 seeds per
 * character is a measurement, not a test).
 */
import { TICK_HZ } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { RACER_IDS } from '../types.ts';
import { type Run, race } from './race-bots.ts';

const RACES_TIMEOUT_MS = 120_000;

const raceSeeds = (bot: keyof typeof BOT_PROFILES, count: number): Run[] =>
  Array.from({ length: count }, (_, i) => race(BOT_PROFILES[bot], 'gil', i + 1, 'normal'));

const seconds = (ticks: number | null) => (ticks === null ? 'DNF' : (ticks / TICK_HZ).toFixed(1));
const table = (runs: Run[]): string =>
  runs
    .map(
      (run) =>
        `seed ${run.seed}: place ${run.playerPlace}; ${RACER_IDS.map((id) => `${id} ${seconds(run.finish[id])}`).join(', ')}`,
    )
    .join('\n');

describe('Normal', () => {
  it(
    'lets a novice win between a fifth and a half of 24 races and place top two in most',
    () => {
      const runs = raceSeeds('novice', 24);
      const wins = runs.filter((run) => run.playerPlace === 1).length;
      const topTwo = runs.filter((run) => run.playerPlace <= 2).length;
      expect(wins, `novice wins:\n${table(runs)}`).toBeGreaterThanOrEqual(5);
      expect(wins, `novice wins:\n${table(runs)}`).toBeLessThanOrEqual(12);
      expect(topTwo, `novice top two:\n${table(runs)}`).toBeGreaterThanOrEqual(13);
    },
    RACES_TIMEOUT_MS,
  );

  it(
    'lets an expert win every one of 12 races',
    () => {
      const runs = raceSeeds('expert', 12);
      expect(runs.filter((run) => run.playerPlace === 1).length, `expert wins:\n${table(runs)}`).toBe(12);
    },
    RACES_TIMEOUT_MS,
  );
});
