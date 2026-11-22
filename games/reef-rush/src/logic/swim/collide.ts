/**
 * Moving bodies through the tile grid without entering solid tiles, and
 * pushing apart racers that overlap.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from '../events.ts';
import type { Body, Level, Racer } from '../types.ts';

/**
 * Integrates a body's position by its velocity for one tick, resolving X then Y
 * against solid tiles and zeroing the blocked velocity component. Sub-steps fast
 * movement so a body never tunnels through a tile.
 */
export function moveBody(body: Body, level: Level, broken: ReadonlySet<number>, dt: number): void {
  void body;
  void level;
  void broken;
  void dt;
  throw new Error('not implemented');
}

/**
 * Pushes overlapping racers apart in one pass over pairs (i < j) in array order,
 * splitting the push by mass and exchanging half the relative velocity on that axis.
 * `contacts` holds "a|b" keys of touching pairs; `racer.bumped` fires only when a contact starts.
 */
export function separateRacers(racers: Racer[], contacts: Set<string>, events: EventSink<GameEvent>): void {
  void racers;
  void contacts;
  void events;
  throw new Error('not implemented');
}
