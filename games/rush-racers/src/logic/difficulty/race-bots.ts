/**
 * The race harness every difficulty bar measures with: a bot (`BOT_PROFILES`) drives the player's
 * racer through one whole race on a real course (Sunlit Shallows unless a course id is given), as a
 * character, ability included, against the rivals the seed draws, and the run reports places, finish
 * times, stalls and the rivals' item use. Every racer races to the line so each gap is a real time.
 * Each test file races a run once (`race` memoises), plus the helpers its assertion messages print.
 * Test-only; nothing in the game imports it.
 */
import { EventLog, TICK_DT, TICK_HZ } from '@arcade/core';
import { courseOf, DEFAULT_COURSE } from '../courses/index.ts';
import type { GameEvent } from '../events.ts';
import { RACE_LIMIT_TICKS } from '../race/standings.ts';
import type { CharacterId, Difficulty, PowerUpKind, RacerId, RivalProfile, World } from '../types.ts';
import { createWorld, stepWorld } from '../world.ts';
import { botDriver } from './bot-driver.ts';

/**
 * A test's timeout for racing `races` whole races it hasn't raced yet. A race takes about 1 s on an
 * idle laptop and has measured over 3 s on a CI runner (40 rival-item races overran 120 s there),
 * so the budget is 6 s a race: it only ends a test that has stopped making progress.
 */
export const racesTimeoutMs = (races: number): number => races * 6_000;

/** The rival slots, in race order. */
export const RIVAL_IDS = ['tess', 'squib', 'bo'] as const;

/** One rival's item use in a race. */
export interface RivalItems {
  id: (typeof RIVAL_IDS)[number];
  character: CharacterId;
  /** Items it fired (`item.used`). */
  uses: number;
}

/** What one whole race reports. */
export interface Run {
  seed: number;
  /** Finish tick per racer, null when it never finished. */
  finish: Record<RacerId, number | null>;
  playerPlace: number;
  /** Hits and squid latches that landed on the player, caused by a rival's power-up. */
  rivalHitsOnPlayer: number;
  /** Times the player was stunned. */
  playerStuns: number;
  /** Times the player dashed (`racer.kicked`) or fired an item (`item.used`). */
  playerActions: { dashes: number; uses: number };
  /**
   * Per racer, the longest stretch of racing ticks, free of stuns and traps, without a new best
   * (lowest) progress before it finished.
   */
  longestStall: Record<RacerId, number>;
  /** Each rival's character and item uses, in slot order. */
  rivalItems: RivalItems[];
  /** The kinds the rivals fired, each once. */
  rivalKindsFired: PowerUpKind[];
}

/** One racer's stall count: its best progress so far, ticks since it improved, and the longest such stretch. */
interface StallCount {
  best: number;
  since: number;
  longest: number;
}

/**
 * Runs already raced in this file, by bot profile object and then by course, character, seed and
 * level. Keyed on the profile object because every bot profile carries the player's racer id.
 */
const raced = new WeakMap<RivalProfile, Map<string, Run>>();

/**
 * One whole race with `bot` driving the player's racer as `character`, on `difficulty` and the
 * course with `courseId`. Raced once per test file; asking again returns the same run.
 *
 * @throws {Error} When `courseId` is neither a shipped nor a registered course.
 */
export function race(
  bot: RivalProfile,
  character: CharacterId,
  seed: number,
  difficulty: Difficulty = 'hard',
  courseId: string = DEFAULT_COURSE.id,
): Run {
  const byBot = raced.get(bot) ?? new Map<string, Run>();
  raced.set(bot, byBot);
  const key = `${courseId}/${character}/${seed}/${difficulty}`;
  const known = byBot.get(key);
  if (known) return known;
  const run = raceOnce(bot, character, seed, difficulty, courseId);
  byBot.set(key, run);
  return run;
}

/** Races once, unmemoised: see `race`. */
function raceOnce(
  bot: RivalProfile,
  character: CharacterId,
  seed: number,
  difficulty: Difficulty,
  courseId: string,
): Run {
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(courseOf({ course: courseId }), log, {
    seed,
    difficulty,
    playerBot: bot,
    endsWhen: 'everyone',
    character,
  });
  const stalls = new Map<RacerId, StallCount>(
    world.racers.map((racer) => [racer.id, { best: Number.POSITIVE_INFINITY, since: 0, longest: 0 }]),
  );
  const drive = botDriver(world, bot);
  // Countdown plus the race limit, with room to spare; the race ends itself well before this.
  for (let i = 0; i < RACE_LIMIT_TICKS + 1000 && world.race.phase !== 'finished'; i++) {
    stepWorld(world, drive(world), TICK_DT);
    countStalls(world, stalls);
  }
  const finish = Object.fromEntries(world.racers.map((r) => [r.id, r.finished?.tick ?? null])) as Run['finish'];
  const longestStall = Object.fromEntries([...stalls].map(([id, count]) => [id, count.longest])) as Run['longestStall'];
  const events = log.all();
  const rivalHitsOnPlayer = events.filter(
    (event) =>
      (event.type === 'racer.hit' && event.id === 'player' && event.by !== null && event.by !== 'player') ||
      (event.type === 'squid.latched' && event.id === 'player' && event.by !== 'player'),
  ).length;
  const playerStuns = events.filter((event) => event.type === 'racer.stunned' && event.id === 'player').length;
  const playerActions = {
    dashes: events.filter((event) => event.type === 'racer.kicked' && event.id === 'player').length,
    uses: events.filter((event) => event.type === 'item.used' && event.id === 'player').length,
  };
  const playerPlace = world.race.result?.playerPlace ?? 4;
  const rivalUses = events.flatMap((event) => (event.type === 'item.used' && event.id !== 'player' ? [event] : []));
  const rivalItems = RIVAL_IDS.map((id) => ({
    id,
    character: racerCharacter(world, id),
    uses: rivalUses.filter((event) => event.id === id).length,
  }));
  const rivalKindsFired = [...new Set(rivalUses.map((event) => event.kind))];
  return {
    seed,
    finish,
    playerPlace,
    rivalHitsOnPlayer,
    playerStuns,
    playerActions,
    longestStall,
    rivalItems,
    rivalKindsFired,
  };
}

/**
 * The character racing in slot `id`.
 *
 * @throws {Error} When the world has no racer in that slot.
 */
function racerCharacter(world: World, id: RacerId): CharacterId {
  const racer = world.racers.find((candidate) => candidate.id === id);
  if (!racer) throw new Error(`The race has no racer in slot '${id}'`);
  return racer.character;
}

/**
 * Advances each unfinished racer's stall count by one tick, while the race is on. A stun or trap
 * restarts the count, as it does the rivals' own progress backstop: a racer a hazard holds still
 * isn't stuck on the course's geometry.
 */
function countStalls(world: World, stalls: Map<RacerId, StallCount>): void {
  if (world.race.phase !== 'racing') return;
  for (const racer of world.racers) {
    const count = stalls.get(racer.id);
    if (!count || racer.finished) continue;
    if (racer.status.stunned > 0 || racer.status.trapped > 0) {
      count.since = 0;
      continue;
    }
    if (racer.progress < count.best) {
      count.best = racer.progress;
      count.since = 0;
      continue;
    }
    count.since++;
    count.longest = Math.max(count.longest, count.since);
  }
}

/**
 * A good race's mean expert finish as fractions of the course's par. Per-character means measure
 * 0.95-1.03 of Sunlit's par and five-seed means 0.97-1.06, so this catches a tuning that moves
 * race length by more than about 9 s.
 */
const PAR_BAND = { min: 0.92, max: 1.08 } as const;

/**
 * The mean expert finish, in ticks, that counts as a good race on the course with `courseId`.
 *
 * @throws {Error} When `courseId` is neither a shipped nor a registered course.
 */
export function parBand(courseId: string): { min: number; max: number } {
  const { parTicks } = courseOf({ course: courseId });
  return { min: PAR_BAND.min * parTicks, max: PAR_BAND.max * parTicks };
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

/**
 * The mean player finish over the runs it finished, in ticks. `courseId` names the course in the error.
 *
 * @throws {Error} When the player finished none of the runs, so there is no mean to judge.
 */
export function meanPlayerFinish(runs: Run[], courseId: string): number {
  const times = runs.map((run) => run.finish.player).filter((t) => t !== null);
  if (times.length === 0) {
    throw new Error(`The player finished none of ${runs.length} runs on '${courseId}', so it has no mean finish`);
  }
  return times.reduce((sum, t) => sum + t, 0) / times.length;
}

/** The largest rival finish time over the player's, across runs; Infinity when anyone failed to finish. */
export function slowestRivalRatio(runs: Run[]): number {
  let worst = 0;
  for (const run of runs) {
    for (const id of RIVAL_IDS) {
      const rival = run.finish[id];
      const player = run.finish.player;
      if (rival === null || player === null) return Number.POSITIVE_INFINITY;
      worst = Math.max(worst, rival / player);
    }
  }
  return worst;
}
