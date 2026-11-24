/**
 * Rivals use items a lot on Normal, every character of them. Each character's band races the first
 * RACES seeds in which that character is drawn as a rival, with the no-dash bot as the player (it
 * never fires, so every use is a rival's), and bands the character's median item uses per race.
 *
 * The player is Rudy for every character but Rudy, and those seed sets overlap, so the seven bands
 * share one file (`rival-items.test.ts`): `race` memoises, and the file races the 108 seeds of their
 * union once instead of 280 races. Rudy's band races against Gil in `rival-items-rudy.test.ts`. The
 * shared races also check that every item kind gets fired (`describeRivalKinds`).
 *
 * Measured at v2 phase 4 (two clam rolls for a rival, `CLAM.rivalRolls`) on Sunlit Shallows over
 * these races, median uses per race: Rudy 7.5, Gil 9.5, Streak 6, Onyx 7, Nib 8, Baron 6.5,
 * Selene 6, Rook 9. With three rolls Nib reached 14 and Rook 12; with one, the median rival used 4.
 * Remeasured after the long-courses extension (par 132 s to 154.5 s, Normal rivals pacing 2 tiles
 * back): Rudy 7.5, Gil 9, Streak 5, Onyx 6, Nib 12, Baron 9, Selene 7.5, Rook 9.
 * Every kind fires in these races. Test-only.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { DEFAULT_COURSE } from '../courses/index.ts';
import type { GameEvent } from '../events.ts';
import { CHARACTER_IDS, type CharacterId, POWER_UP_KINDS } from '../types.ts';
import { createWorld } from '../world.ts';
import { race, racesTimeoutMs } from './race-bots.ts';

/** Races per character: medians over 16 or 24 races still moved 1.5 uses with small tuning changes. */
const RACES = 40;

/**
 * A rival's median item uses per race on Normal must fall in this band: busy, but not a blur. The
 * floor was 5 until the harder course (surface section, cave) took Selene's median to 4.5. The cap
 * was 10 until the course grew from 132 s to 154.5 s par: Nib, the hoarder (item aggression 1, a
 * four-item pocket), went from 8 to 12, one item every 13 s, the rate 10 allowed on the shorter race.
 */
const USES_BAND = { min: 4.5, max: 12 } as const;

/** Each band races at most its RACES seeds; the kinds check reuses the bands' races. */
const RACES_TIMEOUT_MS = racesTimeoutMs(RACES);

/** The player's character for `character`'s races: Rudy, or Gil when the rival measured is Rudy. */
const playerFor = (character: CharacterId): CharacterId => (character === 'rudy' ? 'gil' : 'rudy');

/** The rivals' characters seed by seed for each player character, so the bands in one file build each world once. */
const drawn = new Map<CharacterId, CharacterId[][]>();

/** The characters the rivals race as on `seed` when the player is `player`. */
function rivalsOn(player: CharacterId, seed: number): CharacterId[] {
  const bySeed = drawn.get(player) ?? [];
  drawn.set(player, bySeed);
  const known = bySeed[seed];
  if (known) return known;
  const world = createWorld(DEFAULT_COURSE, new EventLog<GameEvent>(), { seed, character: player });
  const rivals = world.racers.filter((racer) => racer.id !== 'player').map((racer) => racer.character);
  bySeed[seed] = rivals;
  return rivals;
}

/** The first `count` seeds from 1 in which `character` races as a rival of `player`. */
function seedsWithRival(character: CharacterId, player: CharacterId, count: number): number[] {
  const seeds: number[] = [];
  for (let seed = 1; seeds.length < count; seed++) {
    if (rivalsOn(player, seed).includes(character)) seeds.push(seed);
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

/**
 * Registers the check that rivals fire every item kind on Normal, over the races the bands of every
 * character but Rudy run (Rudy as the no-dash player), so in their file it races nothing new.
 */
export function describeRivalKinds(): void {
  describe('rival item kinds on Normal', () => {
    it(
      'fires every item kind in at least one race',
      () => {
        const seeds = new Set(
          CHARACTER_IDS.filter((character) => character !== 'rudy').flatMap((character) =>
            seedsWithRival(character, 'rudy', RACES),
          ),
        );
        const fired = new Set(
          [...seeds].flatMap((seed) => race(BOT_PROFILES.noDash, 'rudy', seed, 'normal').rivalKindsFired),
        );

        expect(POWER_UP_KINDS.filter((kind) => !fired.has(kind))).toEqual([]);
      },
      RACES_TIMEOUT_MS,
    );
  });
}
