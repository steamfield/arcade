/**
 * The stuck-prone kid: a scripted player who holds toward the finish (right) and steers up or down
 * only after 1.5 s without getting any closer, alternating between the two, kicking rarely and
 * never bursting. Rival bots follow the medium's way and never get stuck, so this is the player the
 * Easy guide is measured on. Races run on the real course; the result is the time spent stuck and
 * the finish place. Test and measurement only; nothing in the game imports it.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { tileOf } from '../ai/steer.ts';
import { DEFAULT_COURSE } from '../courses/index.ts';
import type { GameEvent } from '../events.ts';
import { mediumOf } from '../media/index.ts';
import { RACE_LIMIT_TICKS } from '../race/standings.ts';
import { centreOf, playerOf } from '../racers.ts';
import type { CharacterId, Difficulty, Intent, World } from '../types.ts';
import { createWorld, stepWorld } from '../world.ts';

/** How the kid plays, in ticks (60 per second). */
export const KID = {
  /** Without getting closer this long, the kid tries up or down. */
  giveUpAfter: 90,
  /** How long one up-or-down try lasts before the kid goes back to holding right. */
  tryFor: 45,
  /** One kick this often, a rare habit. */
  kickEvery: 480,
  /** Tiles of progress that count as getting closer. */
  gainTiles: 0.25,
  /** A spell without a step along the route this long counts as stuck time. */
  stuckAfter: 60,
} as const;

/** What the kid remembers between ticks. */
export interface KidMemory {
  /** The best reading so far (lower is closer). */
  best: number;
  /** The tick the kid last got closer. A try that ends does not reset it, so a failed try is followed by another at once. */
  lastGain: number;
  /** Ticks left on the current up-or-down try. */
  trying: number;
  /** The way the next try goes: -1 up, 1 down; flips after each try. */
  nextTry: -1 | 1;
  /** The vertical stick of the current try. */
  vertical: -1 | 0 | 1;
}

/** A kid about to start. */
export function newKid(): KidMemory {
  return { best: Number.POSITIVE_INFINITY, lastGain: 0, trying: 0, nextTry: -1, vertical: 0 };
}

/**
 * Notes whether `reading` (lower is closer) beat the kid's best by `minGain`, updating `best` and
 * `lastGain`. The kid judges progress by how far right it has got: it knows where the finish is
 * on the screen, not the route.
 */
export function gainedGround(kid: KidMemory, reading: number, minGain: number, tick: number): boolean {
  if (kid.best !== Number.POSITIVE_INFINITY && reading >= kid.best - minGain) return false;
  kid.best = reading;
  kid.lastGain = tick;
  return true;
}

/** The player's distance to the finish by the uniform-cost progress field: what getting closer looks like to a child, coral gates included. */
const nearness = (world: World): number => playerOf(world).progress;

/** The medium's distance to the finish at the player's tile: the true route, which only a real gain lowers. */
const routeDistance = (world: World): number => mediumOf(world).distanceAt(world, tileOf(centreOf(playerOf(world))));

/**
 * The kid's input for this tick: right, plus up or down for a try that lasts while the kid keeps
 * getting closer and runs out `KID.tryFor` ticks after it stops, then right alone again.
 */
export function kidInput(kid: KidMemory, world: World): Intent {
  const gained = gainedGround(kid, nearness(world), KID.gainTiles, world.tick);
  if (kid.trying > 0) {
    kid.trying = gained ? KID.tryFor : kid.trying - 1;
    if (kid.trying === 0) kid.vertical = 0;
  } else if (world.tick - kid.lastGain >= KID.giveUpAfter) {
    kid.trying = KID.tryFor;
    kid.vertical = kid.nextTry;
    kid.nextTry = kid.nextTry === -1 ? 1 : -1;
  }
  const kick = world.race.raceTick > 0 && world.race.raceTick % KID.kickEvery === 0;
  return { move: { x: 1, y: kid.vertical }, kick, burst: false };
}

/** What one scripted race reports. */
export interface KidRun {
  seed: number;
  /** Ticks past the first second of each spell without getting closer to the finish. */
  stuckTicks: number;
  /** The longest such spell. */
  longestStuck: number;
  playerPlace: number;
  /** The player's finish tick, null if never. */
  finish: number | null;
}

/** Races the kid as `character` on `difficulty` until the player finishes. */
export function kidRace(character: CharacterId, seed: number, difficulty: Difficulty): KidRun {
  const world = createWorld(DEFAULT_COURSE, new EventLog<GameEvent>(100_000), { seed, difficulty, character });
  const kid = newKid();
  const watch = newKid();
  let stuckTicks = 0;
  let longest = 0;
  for (let i = 0; i < RACE_LIMIT_TICKS + 1000 && world.race.phase !== 'finished'; i++) {
    const racing = world.race.phase === 'racing' && !playerOf(world).finished;
    const input = racing ? kidInput(kid, world) : { move: { x: 0, y: 0 }, kick: false, burst: false };
    stepWorld(world, input, TICK_DT);
    if (!racing) continue;
    // The tracker reads the state after the step, so a gain on this tick ends the spell this tick.
    gainedGround(watch, routeDistance(world), 0, world.tick);
    if (world.tick - watch.lastGain >= KID.stuckAfter) {
      stuckTicks++;
      longest = Math.max(longest, world.tick - watch.lastGain);
    }
  }
  return {
    seed,
    stuckTicks,
    longestStuck: longest,
    playerPlace: world.race.result?.playerPlace ?? 4,
    finish: playerOf(world).finished?.tick ?? null,
  };
}
