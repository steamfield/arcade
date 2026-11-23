/**
 * The shared fall, park and respawn timer for media with open pits (`effects.pitBelow`): run and
 * flight both put a fallen racer out of play for a while and bring it back on a spot the medium
 * chose. Each medium keeps its own rule for which spots are safe and calls these from `afterMove`.
 * A racer is out while `status.fallen` is above 0; `tickStatuses` leaves that count to the medium.
 *
 * Scaffold: signatures only. Phase 1 lane a fills them in and moves run's `respawn.ts` onto them.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from '../events.ts';
import type { Racer, Vec } from '../types.ts';

/**
 * Starts a fall: stops the racer where it is (out of the level, below its last row), remembers that
 * spot as where it waits, sets `status.fallen` to `respawnTicks` and emits `racer.fell`.
 *
 * @throws {Error} Not implemented yet.
 */
export function fallOut(_racer: Racer, _events: EventSink<GameEvent>, _respawnTicks: number): void {
  throw new Error('not implemented');
}

/**
 * Holds a fallen racer on the spot `fallOut` stopped it at, at rest: generic movement after
 * `applyIntent` (a dash item, an Undertow, a latch drift) would otherwise slide it. The medium
 * calls it each tick the racer is out, counts `status.fallen` down, and calls `respawnAt` at 0.
 *
 * @throws {Error} Not implemented yet.
 */
export function holdParked(_racer: Racer): void {
  throw new Error('not implemented');
}

/**
 * Puts a fallen racer back with its top-left on `spot`, at rest, invulnerable for `invulnTicks`,
 * and emits `racer.respawned` with where it came back. The medium resets its own motion state.
 *
 * @throws {Error} Not implemented yet.
 */
export function respawnAt(_racer: Racer, _spot: Vec, _invulnTicks: number, _events: EventSink<GameEvent>): void {
  throw new Error('not implemented');
}
