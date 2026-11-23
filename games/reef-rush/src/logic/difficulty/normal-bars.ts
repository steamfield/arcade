/**
 * The Normal bars, shared by one test file per character so Vitest runs them in parallel. Normal only
 * softens Hard (the per-character bars in this folder are Hard's), so what it promises is a band: a
 * casual adult (the novice bot) wins some races and places top two in most. A sample of seeds
 * stands in for the full 200 (see the lane report). Test-only; nothing in the game imports it.
 */
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { courseOf, DEFAULT_COURSE } from '../courses/index.ts';
import type { CharacterId } from '../types.ts';
import { race, table } from './race-bots.ts';

const SEEDS = 10;

/**
 * Registers the Normal band for the novice bot racing as `character` on the course with `courseId`.
 *
 * @throws {Error} When `courseId` is neither a shipped nor a registered course.
 */
export function describeNormal(character: CharacterId, courseId: string = DEFAULT_COURSE.id): void {
  describe(`Normal on ${courseOf({ course: courseId }).name} as ${character}`, () => {
    it(`lets a novice win between a sixth and 60% of ${SEEDS} races and place top two in at least half`, () => {
      const runs = Array.from({ length: SEEDS }, (_, i) =>
        race(BOT_PROFILES.novice, character, i + 1, 'normal', courseId),
      );
      const wins = runs.filter((run) => run.playerPlace === 1).length;
      const topTwo = runs.filter((run) => run.playerPlace <= 2).length;
      expect(wins, `novice wins:\n${table(runs)}`).toBeGreaterThanOrEqual(Math.ceil(SEEDS / 6));
      expect(wins, `novice wins:\n${table(runs)}`).toBeLessThanOrEqual(Math.floor(SEEDS * 0.6));
      expect(topTwo, `novice top two:\n${table(runs)}`).toBeGreaterThanOrEqual(SEEDS / 2);
    }, 120_000);
  });
}
