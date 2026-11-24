/**
 * One racer's movement for one tick: running, braking, steering, jumping, dashing, the dash meter,
 * the course's features (hills, pits, mud, gusts, logs), falling and respawning, and the finish
 * line. Emits the racer's own events. Knows nothing about other racers or the race phase.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from './events.ts';
import type { Course, Racer, TickInput } from './types.ts';

/** Controls that do nothing, for racers with no input this tick. */
export const NO_INPUT: TickInput = {
  forward: false,
  brake: false,
  steer: 0,
  jumpPressed: false,
  jumpHeld: false,
  dashPressed: false,
  firePressed: false,
  nextPressed: false,
  prevPressed: false,
};

/** What `stepRacer` needs besides the racer: the course, the events sink, and race ticks so far (for `finishTicks`). */
export interface RacerContext {
  course: Course;
  events: EventSink<GameEvent>;
  raceTicks: number;
}

/** Advances `racer` by one tick of `input` while the race is running. A finished racer is left alone. */
export function stepRacer(racer: Racer, input: TickInput, ctx: RacerContext, dt: number): void {
  void racer;
  void input;
  void ctx;
  void dt;
  throw new Error('not implemented');
}
