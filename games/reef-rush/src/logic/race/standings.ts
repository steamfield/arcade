/**
 * The race's referee: countdown, each racer's progress, finishes, places and
 * when the race is over. Reads bodies; never moves them.
 */
import type { World } from '../types.ts';

/** Ticks from the first countdown beep to the start signal. */
export const COUNTDOWN_TICKS = 180;
/** Ticks the player gets after the third rival finishes before the race ends without them. */
export const DNF_GRACE_TICKS = 600;
/** Race ticks after which the race ends regardless. */
export const RACE_LIMIT_TICKS = 18000;

/**
 * Advances the race clock one tick. During the countdown it emits `race.countdown` at 0/60/120 and, on
 * reaching 180, `race.started`, switching to racing with `raceTick` 0. While racing it adds 1 to `raceTick`.
 * Returns true while the countdown is still running (racers stay put); false on the start tick and after.
 */
export function advanceClock(world: World): boolean {
  void world;
  throw new Error('not implemented');
}

/** Sets every unfinished racer's `progress` from the progress field. */
export function updateProgress(world: World): void {
  void world;
  throw new Error('not implemented');
}

/** Records racers whose centre crossed the finish line this tick and emits `racer.finished`. */
export function recordFinishes(world: World): void {
  void world;
  throw new Error('not implemented');
}

/** Ranks racers (finished by place, then by progress, ties by RACER_IDS) and emits `player.place` on change. */
export function updatePlaces(world: World): void {
  void world;
  throw new Error('not implemented');
}

/** Ends the race when the player finishes, the DNF grace expires or the time limit hits; emits `race.finished` once. */
export function checkRaceEnd(world: World): void {
  void world;
  throw new Error('not implemented');
}
