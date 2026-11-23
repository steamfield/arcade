/**
 * The Easy bars for a loose-steering child (the novice bot: rare kicks, no items): a sample of seeds
 * on one character (the full 200 seeds per character is a measurement, not a test).
 */
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { race, slowestRivalRatio, table } from './race-bots.ts';

const SEEDS = Array.from({ length: 8 }, (_, i) => i + 1);

describe('Easy with a novice bot', () => {
  const runs = SEEDS.map((seed) => race(BOT_PROFILES.novice, 'rudy', seed, 'easy'));

  it('wins at least two races in three and places top two in at least 90%', () => {
    const wins = runs.filter((run) => run.playerPlace === 1).length;
    const topTwo = runs.filter((run) => run.playerPlace <= 2).length;
    expect(wins, `novice wins:\n${table(runs)}`).toBeGreaterThanOrEqual(Math.ceil((SEEDS.length * 2) / 3));
    expect(topTwo, `novice top two:\n${table(runs)}`).toBeGreaterThanOrEqual(Math.ceil(SEEDS.length * 0.9));
  });

  it('races visibly: every rival finishes within 1.6x the player time', () => {
    expect(slowestRivalRatio(runs), table(runs)).toBeLessThanOrEqual(1.6);
  });

  it('never has a rival power-up land on the player', () => {
    expect(
      runs.map((run) => run.rivalHitsOnPlayer),
      table(runs),
    ).toEqual(SEEDS.map(() => 0));
  });
});
