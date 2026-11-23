/**
 * Rivals use items a lot on Normal: over a fixed set of races, each rival slot's median item uses per
 * race is at least 5, and every item kind is fired by a rival in at least one race. The player is
 * the no-dash bot (it never fires, so every use is a rival's), racing as each character in turn so
 * every character also races as a rival. The bar is per slot, not per character: the roster gives
 * characters different item habits on purpose (Streak and Onyx fire least).
 *
 * Measured at v2 phase 4 (three clam rolls for a rival) on Sunlit Shallows over these 24 races: slot
 * medians 10 (tess), 7 (squib) and 11.5 (bo), 10 over all 72 rival races (4 before the extra rolls);
 * every kind fired, the rarest in 5 races (Undertow) and 7 (Puffer). Test-only.
 */
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { CHARACTER_IDS, POWER_UP_KINDS } from '../types.ts';
import { RIVAL_IDS, race } from './race-bots.ts';

/** 24 races: seeds 1-24, the player's character cycling through the cast. */
const RACES = Array.from({ length: 24 }, (_, i) => ({
  seed: i + 1,
  character: CHARACTER_IDS[i % CHARACTER_IDS.length] ?? 'rudy',
}));

const MIN_MEDIAN_USES = 5;

/** Twenty-four whole races, with room for a loaded machine. */
const RACES_TIMEOUT_MS = 120_000;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

describe('rival item use on Normal', () => {
  const runs = () => RACES.map(({ seed, character }) => race(BOT_PROFILES.noDash, character, seed, 'normal'));

  it.each(RIVAL_IDS)(
    `rival %s fires a median of at least ${MIN_MEDIAN_USES} items a race`,
    (id) => {
      const uses = runs().map((run) => run.rivalItems.find((rival) => rival.id === id)?.uses ?? 0);

      expect(median(uses), `${id}'s item uses per race: ${uses.join(' ')}`).toBeGreaterThanOrEqual(MIN_MEDIAN_USES);
    },
    RACES_TIMEOUT_MS,
  );

  it(
    'fires every item kind in at least one race',
    () => {
      const fired = new Set(runs().flatMap((run) => run.rivalKindsFired));

      expect(POWER_UP_KINDS.filter((kind) => !fired.has(kind))).toEqual([]);
    },
    RACES_TIMEOUT_MS,
  );
});
