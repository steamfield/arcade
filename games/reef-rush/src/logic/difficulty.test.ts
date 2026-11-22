/**
 * Difficulty is measured, not eyeballed. Bots drive the player's racer through whole races on
 * the real course: an expert (rival AI with player physics, full kicks and items) and a novice
 * (loose steering, an occasional kick, no items). Every racer races to the line so each gap is a
 * real time. Thirty seeds, with bars set below the rates the tuning reaches over many more, so a
 * pass doesn't hang on one lucky seed. Results go into assertion messages; the per-seed table
 * prints when a bar is missed.
 */
import { EventLog, TICK_DT, TICK_HZ } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from './ai/profiles.ts';
import type { GameEvent } from './events.ts';
import { OCEAN_LEVEL } from './level/levels.ts';
import { parseLevel } from './level/parse.ts';
import { RACE_LIMIT_TICKS } from './race/standings.ts';
import type { RacerId, RivalProfile } from './types.ts';
import { createWorld, stepWorld } from './world.ts';

const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);
const IDLE = { move: { x: 0, y: 0 }, kick: false, burst: false };

interface Run {
  seed: number;
  /** Finish tick per racer, null when it never finished. */
  finish: Record<RacerId, number | null>;
  playerPlace: number;
}

function race(bot: RivalProfile, seed: number): Run {
  const level = parseLevel(OCEAN_LEVEL);
  const world = createWorld(level, new EventLog<GameEvent>(), { seed, playerBot: bot, endsWhen: 'everyone' });
  // Countdown plus the race limit, with room to spare; the race ends itself well before this.
  for (let i = 0; i < RACE_LIMIT_TICKS + 1000 && world.race.phase !== 'finished'; i++) stepWorld(world, IDLE, TICK_DT);
  const finish = Object.fromEntries(world.racers.map((r) => [r.id, r.finished?.tick ?? null])) as Run['finish'];
  return { seed, finish, playerPlace: world.race.result?.playerPlace ?? 4 };
}

const seconds = (ticks: number) => (ticks / TICK_HZ).toFixed(1);

function table(runs: Run[]): string {
  return runs
    .map(({ seed, finish, playerPlace }) => {
      const times = Object.entries(finish).map(([id, t]) => `${id} ${t === null ? 'DNF' : seconds(t)}`);
      return `seed ${seed}: place ${playerPlace}; ${times.join(', ')}`;
    })
    .join('\n');
}

function rivalBest(run: Run): number | null {
  const times = (['tess', 'squib', 'bo'] as const).map((id) => run.finish[id]).filter((t) => t !== null);
  return times.length ? Math.min(...times) : null;
}

/** Whole races take a while; each test runs up to 30 of them. */
const RACES_TIMEOUT_MS = 60_000;

let expertCache: Run[] | null = null;
/** Both expert bars read the same races, so they run once. */
function expert(): Run[] {
  expertCache ??= SEEDS.map((seed) => race(BOT_PROFILES.expert, seed));
  return expertCache;
}

describe('difficulty on the full course', () => {
  it(
    'an expert wins at least 21 of 30 seeds, with the lead rival within 8 s of it',
    () => {
      const runs = expert();
      const close = runs.filter((run) => {
        const player = run.finish.player;
        const rival = rivalBest(run);
        return run.playerPlace === 1 && player !== null && rival !== null && rival - player <= 8 * TICK_HZ;
      });
      expect(close.length, `expert wins with the lead rival within 8 s:\n${table(runs)}`).toBeGreaterThanOrEqual(21);
    },
    RACES_TIMEOUT_MS,
  );

  it(
    'a novice places 3rd or 4th in most seeds and finishes within 1.3x the winner time',
    () => {
      const runs = SEEDS.map((seed) => race(BOT_PROFILES.novice, seed));
      const behind = runs.filter((run) => run.playerPlace >= 3);
      expect(behind.length, `novice placed 3rd or 4th:\n${table(runs)}`).toBeGreaterThanOrEqual(21);
      const inTouch = runs.filter((run) => {
        const player = run.finish.player;
        const times = Object.values(run.finish).filter((t) => t !== null);
        return player !== null && player <= 1.3 * Math.min(...times);
      });
      expect(inTouch.length, `novice finished within 1.3x the winner time:\n${table(runs)}`).toBeGreaterThanOrEqual(24);
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
