/**
 * The difficulty bars, shared by two test files per character in this folder (expert bars, novice bar) so Vitest runs the
 * characters in parallel. Bots drive the player's racer through whole races on the real course: an
 * expert (rival AI with player physics, full kicks and items) and a novice (loose steering, an
 * occasional kick, no items). The player races as the character, ability included, against the
 * rivals that pick draws. Every racer races to the line so each gap is a real time. Thirty seeds
 * per character, with bars set below the rates the tuning reaches over many more, so a pass doesn't
 * hang on one lucky seed. Results go into assertion messages; the per-seed table prints when a bar
 * is missed. Test-only; nothing in the game imports it.
 */
import { EventLog, TICK_DT, TICK_HZ } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { DEFAULT_COURSE } from '../courses/index.ts';
import type { GameEvent } from '../events.ts';
import { RACE_LIMIT_TICKS } from '../race/standings.ts';
import type { CharacterId, Difficulty, RacerId, RivalProfile } from '../types.ts';
import { createWorld, stepWorld } from '../world.ts';

const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);
const IDLE = { move: { x: 0, y: 0 }, kick: false, burst: false };

/**
 * Balance across the cast: every character's expert wins (any margin) on the 30 seeds fall in this
 * band, so no character wins more than 4 seeds (about 13 points) more than another. A fixed band
 * lets each character's file check it from its own races; the tuning measures 82.5-88.5% plain wins
 * (81.5-88% close wins) for every character over seeds 1-200, inside the band with room on both sides.
 */
export const BALANCE_BAND = { min: 24, max: 28 } as const;

/** Thirty whole races take a while, more under a loaded test run. */
const RACES_TIMEOUT_MS = 120_000;

export interface Run {
  seed: number;
  /** Finish tick per racer, null when it never finished. */
  finish: Record<RacerId, number | null>;
  playerPlace: number;
  /** Hits and squid latches that landed on the player, caused by a rival's power-up. */
  rivalHitsOnPlayer: number;
  /** Times the player was stunned. */
  playerStuns: number;
}

/** One whole race with `bot` driving the player's racer as `character`, on `difficulty` (Hard by default). */
export function race(bot: RivalProfile, character: CharacterId, seed: number, difficulty: Difficulty = 'hard'): Run {
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(DEFAULT_COURSE, log, {
    seed,
    difficulty,
    playerBot: bot,
    endsWhen: 'everyone',
    character,
  });
  // Countdown plus the race limit, with room to spare; the race ends itself well before this.
  for (let i = 0; i < RACE_LIMIT_TICKS + 1000 && world.race.phase !== 'finished'; i++) stepWorld(world, IDLE, TICK_DT);
  const finish = Object.fromEntries(world.racers.map((r) => [r.id, r.finished?.tick ?? null])) as Run['finish'];
  const events = log.all();
  const rivalHitsOnPlayer = events.filter(
    (event) =>
      (event.type === 'racer.hit' && event.id === 'player' && event.by !== null && event.by !== 'player') ||
      (event.type === 'squid.latched' && event.id === 'player' && event.by !== 'player'),
  ).length;
  const playerStuns = events.filter((event) => event.type === 'racer.stunned' && event.id === 'player').length;
  return { seed, finish, playerPlace: world.race.result?.playerPlace ?? 4, rivalHitsOnPlayer, playerStuns };
}

/** A finish tick in seconds, or 'DNF'. */
export const seconds = (ticks: number | null) => (ticks === null ? 'DNF' : (ticks / TICK_HZ).toFixed(1));

/** The per-seed table of places and finish times that assertion messages print. */
export function table(runs: Run[]): string {
  return runs
    .map(({ seed, finish, playerPlace }) => {
      const times = Object.entries(finish).map(([id, t]) => `${id} ${seconds(t)}`);
      return `seed ${seed}: place ${playerPlace}; ${times.join(', ')}`;
    })
    .join('\n');
}

/** The largest rival finish time over the player's, across runs; Infinity when anyone failed to finish. */
export function slowestRivalRatio(runs: Run[]): number {
  let worst = 0;
  for (const run of runs) {
    for (const id of ['tess', 'squib', 'bo'] as const) {
      const rival = run.finish[id];
      const player = run.finish.player;
      if (rival === null || player === null) return Number.POSITIVE_INFINITY;
      worst = Math.max(worst, rival / player);
    }
  }
  return worst;
}

function rivalBest(run: Run): number | null {
  const times = (['tess', 'squib', 'bo'] as const).map((id) => run.finish[id]).filter((t) => t !== null);
  return times.length ? Math.min(...times) : null;
}

/** An expert win that stayed a race: first, with the lead rival in within 8 s. */
function closeWin(run: Run): boolean {
  const player = run.finish.player;
  const rival = rivalBest(run);
  return run.playerPlace === 1 && player !== null && rival !== null && rival - player <= 8 * TICK_HZ;
}

/** Registers the expert bars (wins, balance, race length) for the player racing as `character`. */
export function describeDifficulty(character: CharacterId): void {
  describe(`difficulty on the full course as ${character}`, () => {
    let expertRuns: Run[] | null = null;
    /** Every expert bar reads the same races, so they run once. */
    const expert = (): Run[] => {
      expertRuns ??= SEEDS.map((seed) => race(BOT_PROFILES.expert, character, seed));
      return expertRuns;
    };

    it(
      'an expert wins at least 21 of 30 seeds, with the lead rival within 8 s of it',
      () => {
        const runs = expert();
        expect(runs.filter(closeWin).length, `expert close wins:\n${table(runs)}`).toBeGreaterThanOrEqual(21);
      },
      RACES_TIMEOUT_MS,
    );

    it(
      `an expert wins between ${BALANCE_BAND.min} and ${BALANCE_BAND.max} of 30 seeds, like every other character`,
      () => {
        const runs = expert();
        const wins = runs.filter((run) => run.playerPlace === 1).length;
        expect(wins, `expert wins:\n${table(runs)}`).toBeGreaterThanOrEqual(BALANCE_BAND.min);
        expect(wins, `expert wins:\n${table(runs)}`).toBeLessThanOrEqual(BALANCE_BAND.max);
      },
      RACES_TIMEOUT_MS,
    );

    it(
      'a good race on the course takes about 90 s',
      () => {
        const runs = expert();
        const times = runs.map((run) => run.finish.player).filter((t) => t !== null);
        const mean = times.reduce((sum, t) => sum + t, 0) / Math.max(1, times.length);
        expect(times.length, `expert finished every seed:\n${table(runs)}`).toBe(SEEDS.length);
        expect(mean / TICK_HZ, `mean expert finish ${seconds(mean)} s:\n${table(runs)}`).toBeGreaterThan(75);
        expect(mean / TICK_HZ, `mean expert finish ${seconds(mean)} s:\n${table(runs)}`).toBeLessThan(105);
      },
      RACES_TIMEOUT_MS,
    );
  });
}

/** Registers the novice bar for the player racing as `character`, in a file of its own so it runs beside the expert bars. */
export function describeNovice(character: CharacterId): void {
  describe(`novice on the full course as ${character}`, () => {
    it(
      'a novice places 3rd or 4th in most seeds and finishes within 1.3x the winner time',
      () => {
        const runs = SEEDS.map((seed) => race(BOT_PROFILES.novice, character, seed));
        const behind = runs.filter((run) => run.playerPlace >= 3);
        expect(behind.length, `novice placed 3rd or 4th:\n${table(runs)}`).toBeGreaterThanOrEqual(21);
        const inTouch = runs.filter((run) => {
          const player = run.finish.player;
          const times = Object.values(run.finish).filter((t) => t !== null);
          return player !== null && player <= 1.3 * Math.min(...times);
        });
        expect(inTouch.length, `novice finished within 1.3x the winner time:\n${table(runs)}`).toBeGreaterThanOrEqual(
          24,
        );
      },
      RACES_TIMEOUT_MS,
    );
  });
}
