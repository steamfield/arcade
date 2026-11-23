/**
 * Every item kind gets fired on Normal: over a fixed set of races, each kind is fired by a rival in at
 * least one. The player is the no-dash bot (it never fires, so every use is a rival's), racing as each
 * character in turn so every character also races as a rival. How often each character fires is
 * banded per character in `rival-items-<character>.test.ts`.
 *
 * Measured at v2 phase 4 (two clam rolls for a rival) on Sunlit Shallows over these 24 races: every
 * kind fired, the rarest Puffer (in 4 races) and Undertow (8). Test-only.
 */
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { CHARACTER_IDS, POWER_UP_KINDS } from '../types.ts';
import { race } from './race-bots.ts';

/** 24 races: seeds 1-24, the player's character cycling through the cast. */
const RACES = Array.from({ length: 24 }, (_, i) => ({
  seed: i + 1,
  character: CHARACTER_IDS[i % CHARACTER_IDS.length] ?? 'rudy',
}));

/** Twenty-four whole races, with room for a loaded machine. */
const RACES_TIMEOUT_MS = 120_000;

describe('rival item kinds on Normal', () => {
  it(
    'fires every item kind in at least one race',
    () => {
      const runs = RACES.map(({ seed, character }) => race(BOT_PROFILES.noDash, character, seed, 'normal'));
      const fired = new Set(runs.flatMap((run) => run.rivalKindsFired));

      expect(POWER_UP_KINDS.filter((kind) => !fired.has(kind))).toEqual([]);
    },
    RACES_TIMEOUT_MS,
  );
});
