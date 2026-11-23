/**
 * Rivals use items a lot on Normal, every character of them: shared by one test file per character
 * (`rival-items-<character>.test.ts`) so Vitest runs them in parallel. Each races the first
 * RACES seeds in which the character is drawn as a rival, with the no-dash bot as the player (it
 * never fires, so every use is a rival's), and bands that character's median item uses per race.
 *
 * Measured at v2 phase 4 (two clam rolls for a rival, `CLAM.rivalRolls`) on Sunlit Shallows over
 * these races, median uses per race: Rudy 7.5, Gil 9.5, Streak 6, Onyx 7, Nib 8, Baron 6.5,
 * Selene 6, Rook 9. With three rolls Nib reached 14 and Rook 12; with one, the median rival used 4.
 * Test-only.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { DEFAULT_COURSE } from '../courses/index.ts';
import type { GameEvent } from '../events.ts';
import type { CharacterId } from '../types.ts';
import { createWorld } from '../world.ts';
import { race } from './race-bots.ts';

/** Races per character: medians over 16 or 24 races still moved 1.5 uses with small tuning changes. */
const RACES = 40;

/**
 * A rival's median item uses per race on Normal must fall in this band: busy, but not a blur. The
 * floor was 5 until the harder course (surface section, cave) took Selene's median to 4.5.
 */
export const USES_BAND = { min: 4.5, max: 10 } as const;

/** Forty whole races, with room for a loaded machine. */
const RACES_TIMEOUT_MS = 120_000;

/** The player's character for `character`'s races: Rudy, or Gil when the rival measured is Rudy. */
const playerFor = (character: CharacterId): CharacterId => (character === 'rudy' ? 'gil' : 'rudy');

/** The first `count` seeds from 1 in which `character` races as a rival of `player`. */
function seedsWithRival(character: CharacterId, player: CharacterId, count: number): number[] {
  const seeds: number[] = [];
  for (let seed = 1; seeds.length < count; seed++) {
    const world = createWorld(DEFAULT_COURSE, new EventLog<GameEvent>(), { seed, character: player });
    if (world.racers.some((racer) => racer.id !== 'player' && racer.character === character)) seeds.push(seed);
  }
  return seeds;
}

/** The middle value of `values`, the mean of the two middle ones for an even count. */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** Registers the item-use band for `character` racing as a rival on Normal on Sunlit Shallows. */
export function describeRivalItems(character: CharacterId): void {
  describe(`rival ${character}'s item use on Normal`, () => {
    it(
      `fires a median of ${USES_BAND.min} to ${USES_BAND.max} items a race`,
      () => {
        const player = playerFor(character);
        const uses = seedsWithRival(character, player, RACES).map((seed) => {
          const run = race(BOT_PROFILES.noDash, player, seed, 'normal');
          return run.rivalItems.find((rival) => rival.character === character)?.uses ?? 0;
        });
        const message = `${character}'s item uses per race: ${uses.join(' ')}`;

        expect(median(uses), message).toBeGreaterThanOrEqual(USES_BAND.min);
        expect(median(uses), message).toBeLessThanOrEqual(USES_BAND.max);
      },
      RACES_TIMEOUT_MS,
    );
  });
}
