/**
 * The Easy guide against the stuck-prone kid (see `kid-bot.ts`): on a few seeds of the real course,
 * the same races with the guide off and on. The full measurement (40 seeds, several characters) is
 * in DESIGN.md; this keeps the effect from regressing.
 *
 * Measured at v2 phase 4 (seeds 1-4): 5329 stuck ticks without the guide and 2293 with it. The bar
 * was "less than a third" until rivals got two clam rolls: the unguided kid now gets stuck less
 * (6825 ticks before; rivals firing more Puffers and Cannonballs open more coral, the likely cause),
 * while the guided kid's stuck time barely moved (2117 before).
 */
import { describe, expect, it } from 'vitest';
import { DIFFICULTY } from '../difficulty-level.ts';
import { type KidRun, kidRace } from './kid-bot.ts';

const SEEDS = [1, 2, 3, 4];

/** The kid's races as Rudy on Easy with the guide's knob on or off; the knob goes back as it was. */
function kidRaces(guide: boolean): KidRun[] {
  const original = DIFFICULTY.easy.guide;
  DIFFICULTY.easy.guide = { ...original, enabled: guide };
  try {
    return SEEDS.map((seed) => kidRace('rudy', seed, 'easy'));
  } finally {
    DIFFICULTY.easy.guide = original;
  }
}

const total = (runs: KidRun[], pick: (run: KidRun) => number) => runs.reduce((sum, run) => sum + pick(run), 0);
const table = (runs: KidRun[]) =>
  runs.map((run) => `seed ${run.seed}: stuck ${run.stuckTicks} ticks, place ${run.playerPlace}`).join('\n');

describe('the stuck-prone kid on Easy', () => {
  const unguided = kidRaces(false);
  const guided = kidRaces(true);

  it('spends less than half as long stuck with the guide', () => {
    const before = total(unguided, (run) => run.stuckTicks);
    const after = total(guided, (run) => run.stuckTicks);
    expect(before, `without the guide:\n${table(unguided)}`).toBeGreaterThan(0);
    expect(after, `with the guide:\n${table(guided)}`).toBeLessThan(before / 2);
  });

  it('finishes every race, and places no worse', () => {
    expect(
      guided.map((run) => run.finish !== null),
      table(guided),
    ).toEqual(SEEDS.map(() => true));
    expect(total(guided, (run) => run.playerPlace)).toBeLessThanOrEqual(total(unguided, (run) => run.playerPlace));
  });
});
