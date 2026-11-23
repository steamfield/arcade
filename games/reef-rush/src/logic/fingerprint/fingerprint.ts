/**
 * Fingerprints of the phase-7 ocean race, the guard that phases 8 and 9 change no behaviour. Each
 * fingerprint races one character on Sunlit Shallows with one bot at one difficulty and seed, and
 * every 60 ticks hashes the events since the last snapshot and each racer's body, status and stack.
 * The recorded hashes live in `data/<character>.json`; a mismatch names the race, the tick and the
 * part that first differed.
 *
 * The matrix is trimmed to 64 races (8 per character) and was checked by breaking the code one rule
 * at a time (see the phase 8 Log in plans/reef-rush.md): expert on Hard, seeds 1 and 7; novice on
 * Hard, seed 1; expert and novice on Normal and on Easy, seed 7; the stuck-prone kid on Easy,
 * seed 42 (the only bot that drives the human input path, so the Easy assist runs).
 *
 * Delete this folder after phase 9: it would block every later tuning change.
 *
 * Record with `FINGERPRINT_RECORD=1 pnpm --filter game-reef-rush exec vitest run src/logic/fingerprint`,
 * only on code whose behaviour is the reference. Test-only; nothing in the game imports it.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { DEFAULT_COURSE } from '../courses/index.ts';
import { kidInput, newKid } from '../difficulty/kid-bot.ts';
import type { GameEvent } from '../events.ts';
import { RACE_LIMIT_TICKS } from '../race/standings.ts';
import { playerOf } from '../racers.ts';
import type { CharacterId, Difficulty, Intent, Racer, World } from '../types.ts';
import { createWorld, stepWorld } from '../world.ts';

/** Ticks between snapshots. */
export const SNAPSHOT_EVERY = 60;

/** Who drives the player's racer: a bot profile through the rival AI, or the stuck-prone kid through the human input path. */
export type Driver = 'expert' | 'novice' | 'kid';

export interface FingerprintRace {
  difficulty: Difficulty;
  driver: Driver;
  seed: number;
}

/** The eight races each character is fingerprinted on. */
export const FINGERPRINT_RACES: readonly FingerprintRace[] = [
  { difficulty: 'hard', driver: 'expert', seed: 1 },
  { difficulty: 'hard', driver: 'expert', seed: 7 },
  { difficulty: 'hard', driver: 'novice', seed: 1 },
  { difficulty: 'normal', driver: 'expert', seed: 7 },
  { difficulty: 'normal', driver: 'novice', seed: 7 },
  { difficulty: 'easy', driver: 'expert', seed: 7 },
  { difficulty: 'easy', driver: 'novice', seed: 7 },
  { difficulty: 'easy', driver: 'kid', seed: 42 },
];

/** The names of a snapshot's parts, in the order their hashes are joined. */
export const SNAPSHOT_PARTS = ['events', 'player', 'tess', 'squib', 'bo'] as const;

const IDLE: Intent = { move: { x: 0, y: 0 }, kick: false, burst: false };

/** The key a race's hashes are stored under. */
export function raceKey({ difficulty, driver, seed }: FingerprintRace): string {
  return `${difficulty}/${driver}/${seed}`;
}

/**
 * Races `character` to the end (every racer finishes or the limit) and returns one snapshot per
 * SNAPSHOT_EVERY ticks, plus one for the last tick: each a space-free string of five 4-hex hashes.
 */
export function fingerprint(character: CharacterId, race: FingerprintRace): string[] {
  const log = new EventLog<GameEvent>(100_000);
  const bot = race.driver === 'kid' ? undefined : BOT_PROFILES[race.driver];
  const world = createWorld(DEFAULT_COURSE, log, {
    seed: race.seed,
    difficulty: race.difficulty,
    character,
    endsWhen: 'everyone',
    ...(bot ? { playerBot: bot } : {}),
  });
  const kid = newKid();
  const snapshots: string[] = [];
  let seen = 0;
  const snap = () => {
    const events = log.all();
    snapshots.push(snapshotOf(world, events.slice(seen)));
    seen = events.length;
  };
  for (let i = 0; i < RACE_LIMIT_TICKS + 1000 && world.race.phase !== 'finished'; i++) {
    const playing = race.driver === 'kid' && world.race.phase === 'racing' && !playerOf(world).finished;
    stepWorld(world, playing ? kidInput(kid, world) : IDLE, TICK_DT);
    if (world.tick % SNAPSHOT_EVERY === 0) snap();
  }
  snap();
  return snapshots;
}

function snapshotOf(world: World, events: readonly GameEvent[]): string {
  const parts = [JSON.stringify(events), ...world.racers.map(racerState)];
  return parts.map((part) => hash16(part)).join('');
}

/** The racer state a fingerprint covers: body, status and stack. */
function racerState(racer: Racer): string {
  return JSON.stringify([racer.body, racer.status, racer.stack]);
}

/** A 16-bit FNV-1a hash of `text` as four hex digits. Enough per part: a real change shows in many snapshots. */
function hash16(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ((hash ^ (hash >>> 16)) & 0xffff).toString(16).padStart(4, '0');
}

/**
 * Where `actual` first departs from `recorded`: the tick and the parts that differ there, or null
 * when they match.
 */
export function firstDifference(recorded: readonly string[], actual: readonly string[]): string | null {
  const length = Math.max(recorded.length, actual.length);
  for (let i = 0; i < length; i++) {
    const want = recorded[i];
    const got = actual[i];
    if (want === got) continue;
    const tick =
      i < Math.min(recorded.length, actual.length) || i < actual.length - 1 ? (i + 1) * SNAPSHOT_EVERY : 'end';
    if (want === undefined || got === undefined) {
      return `snapshot ${i} (tick ${tick}): the race ran ${actual.length} snapshots, recorded ${recorded.length}`;
    }
    const parts = SNAPSHOT_PARTS.filter((_, p) => want.slice(p * 4, p * 4 + 4) !== got.slice(p * 4, p * 4 + 4));
    return `snapshot ${i} (tick ${tick}): ${parts.join(', ')} differ`;
  }
  return null;
}
