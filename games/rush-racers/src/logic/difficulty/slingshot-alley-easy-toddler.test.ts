/**
 * The Easy bars on Slingshot Alley for the weakest child, the same bars `easy-toddler.test.ts` sets on
 * Sunlit Shallows: the toddler bot wobbles hard, reacts late and never dashes or uses items, and a
 * scripted race has the child stop for 10 s and then hold right.
 */
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { race, slowestRivalRatio, table } from './race-bots.ts';
import { SCRIPT, scriptedRace } from './scripted-race.ts';

const COURSE_ID = 'slingshot-alley';
const SEEDS = Array.from({ length: 9 }, (_, i) => i + 1);

describe('Easy on Slingshot Alley with a toddler bot', () => {
  const runs = SEEDS.map((seed) => race(BOT_PROFILES.toddler, 'rudy', seed, 'easy', COURSE_ID));

  it('finishes every race and places top two in at least 70%', () => {
    expect(runs.filter((run) => run.finish.player !== null).length, table(runs)).toBe(SEEDS.length);
    expect(runs.filter((run) => run.playerPlace <= 2).length, table(runs)).toBeGreaterThanOrEqual(
      Math.ceil(SEEDS.length * 0.7),
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
    expect(runs.map((run) => run.rivalHitsOnPlayer)).toEqual(SEEDS.map(() => 0));
  });
});

describe(`Easy on Slingshot Alley when the child stops for ${SCRIPT.idleTicks / 60} s mid-race and then holds right`, () => {
  const scripted = [1, 2, 3].map((seed) => scriptedRace('rudy', seed, 'easy', COURSE_ID));

  it('keeps every rival running at a visible pace while the child stands still', () => {
    for (const run of scripted) {
      expect(Math.min(...Object.values(run.rivalSpeedWhileIdle))).toBeGreaterThanOrEqual(25);
    }
  });

  it('lets the child finish and still place top two in at least 2 of 3 races', () => {
    expect(scripted.filter((run) => run.finish.player !== null).length).toBe(scripted.length);
    expect(scripted.filter((run) => run.playerPlace <= 2).length).toBeGreaterThanOrEqual(2);
  });
});
