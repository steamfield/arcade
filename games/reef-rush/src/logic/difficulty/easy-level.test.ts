/**
 * The Easy bars: a 6-year-old who steers loosely, rarely kicks and never presses burst. A sample of
 * seeds on one character (the full 200 seeds per character is a measurement, not a test), with the
 * novice bot standing in for a loose-steering child and the toddler bot for the weakest one.
 */
import { TICK_HZ } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { RACER_IDS } from '../types.ts';
import { type Run, race } from './race-bots.ts';

const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const RACES_TIMEOUT_MS = 120_000;

const raceAll = (bot: keyof typeof BOT_PROFILES): Run[] =>
  SEEDS.map((seed) => race(BOT_PROFILES[bot], 'rudy', seed, 'easy'));

const seconds = (ticks: number | null) => (ticks === null ? 'DNF' : (ticks / TICK_HZ).toFixed(1));
const table = (runs: Run[]): string =>
  runs
    .map(
      (run) =>
        `seed ${run.seed}: place ${run.playerPlace}; ${RACER_IDS.map((id) => `${id} ${seconds(run.finish[id])}`).join(', ')}`,
    )
    .join('\n');

describe('Easy with a novice bot (loose steering, a rare kick, no items)', () => {
  /** Every novice bar reads the same races, so they run once. */
  let noviceRuns: Run[] | null = null;
  const novice = (): Run[] => {
    noviceRuns ??= raceAll('novice');
    return noviceRuns;
  };

  it(
    'wins at least two races in three and places top two in at least 90%',
    () => {
      const wins = novice().filter((run) => run.playerPlace === 1).length;
      const topTwo = novice().filter((run) => run.playerPlace <= 2).length;
      expect(wins, `novice wins:\n${table(novice())}`).toBeGreaterThanOrEqual(Math.ceil((SEEDS.length * 2) / 3));
      expect(topTwo, `novice top two:\n${table(novice())}`).toBeGreaterThanOrEqual(Math.ceil(SEEDS.length * 0.9));
    },
    RACES_TIMEOUT_MS,
  );

  it(
    'races visibly: every rival finishes within 1.6x the player time',
    () => {
      for (const run of novice()) {
        const player = run.finish.player;
        expect(player, `player finished:\n${table(novice())}`).not.toBeNull();
        for (const id of ['tess', 'squib', 'bo'] as const) {
          const rival = run.finish[id];
          expect(rival, `${id} finished:\n${table(novice())}`).not.toBeNull();
          expect(
            (rival ?? 0) / (player ?? 1),
            `seed ${run.seed} ${id} against the player:\n${table(novice())}`,
          ).toBeLessThanOrEqual(1.6);
        }
      }
    },
    RACES_TIMEOUT_MS,
  );

  it(
    'never meets a squid or an Undertow aimed at the player by a rival',
    () => {
      expect(novice().map((run) => run.attacksOnPlayer)).toEqual(SEEDS.map(() => 0));
    },
    RACES_TIMEOUT_MS,
  );
});

describe('Easy with a toddler bot (wobbles hard, reacts late, never kicks or bursts)', () => {
  it(
    'finishes every race and places top two in at least 3 races in 4',
    () => {
      const runs = raceAll('toddler');
      expect(runs.filter((run) => run.finish.player !== null).length, `toddler finished:\n${table(runs)}`).toBe(
        SEEDS.length,
      );
      const topTwo = runs.filter((run) => run.playerPlace <= 2).length;
      expect(topTwo, `toddler top two:\n${table(runs)}`).toBeGreaterThanOrEqual(Math.ceil(SEEDS.length * 0.75));
    },
    RACES_TIMEOUT_MS,
  );
});
