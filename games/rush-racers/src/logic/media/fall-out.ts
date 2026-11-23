/**
 * The shared park and respawn timer for media whose racers can be put out of play: run and
 * flight for a fall through a pit, drift for a black hole. Each puts the racer out for a while and
 * brings it back on a spot the medium chose. Each medium keeps its own rule for which spots are safe and calls these from `afterMove`:
 * `fallOut` once the racer `isBelowLevel`, then `waitOut` each tick it is out, and `respawnAt` on the
 * tick `waitOut` says the wait is over. A racer is out while `status.fallen` is above 0;
 * `tickStatuses` leaves that count to `waitOut`.
 *
 * A medium that uses these keeps a `parkedAt` spot in its racer motion (`ParkingMotion`), where
 * `fallOut` remembers where the racer waits.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from '../events.ts';
import { type Box, type Level, type Racer, TILE, type Vec } from '../types.ts';
import type { RacerMotion } from './types.ts';

/** Racer motion of a medium whose racers can fall out: it holds the spot a fallen racer waits at. */
export interface ParkingMotion extends RacerMotion {
  /** Top-left of where a racer that is out waits until it respawns. */
  parkedAt: Vec;
}

/** True when the top of `body` has passed below the level's last row, so the racer has fallen out. */
export function isBelowLevel(level: Level, body: Box): boolean {
  return body.y >= level.height * TILE;
}

/**
 * Puts a racer out of play: stops it where it is (below the last row after a fall, or wherever the
 * medium's rule caught it), remembers that
 * spot as where it waits, sets `status.fallen` to `respawnTicks` and emits `racer.fell`.
 *
 * @throws {Error} When the racer's motion keeps no `parkedAt` spot.
 */
export function fallOut(racer: Racer, events: EventSink<GameEvent>, respawnTicks: number): void {
  const motion = parkingMotion(racer);
  racer.body.vx = 0;
  racer.body.vy = 0;
  racer.status.fallen = respawnTicks;
  motion.parkedAt = { x: racer.body.x, y: racer.body.y };
  events.emit({ type: 'racer.fell', id: racer.id });
}

/**
 * One tick out of play for a fallen racer: holds it parked (`holdParked`) and counts
 * `status.fallen` down. True on the tick the count reaches 0, when the medium calls `respawnAt` and
 * resets its own motion.
 *
 * @throws {Error} When the racer's motion keeps no `parkedAt` spot.
 */
export function waitOut(racer: Racer): boolean {
  holdParked(racer);
  racer.status.fallen -= 1;
  return racer.status.fallen <= 0;
}

/**
 * Holds a fallen racer on the spot `fallOut` stopped it at, at rest: generic movement after
 * `applyIntent` (a dash item, an Undertow, a latch drift) would otherwise slide it. `waitOut` calls
 * it each tick the racer is out.
 *
 * @throws {Error} When the racer's motion keeps no `parkedAt` spot.
 */
export function holdParked(racer: Racer): void {
  const { parkedAt } = parkingMotion(racer);
  racer.body.x = parkedAt.x;
  racer.body.y = parkedAt.y;
  racer.body.vx = 0;
  racer.body.vy = 0;
}

/**
 * Puts a fallen racer back with its top-left on `spot`, at rest, invulnerable for `invulnTicks`,
 * and emits `racer.respawned` with where it came back. The medium resets its own motion state.
 */
export function respawnAt(racer: Racer, spot: Vec, invulnTicks: number, events: EventSink<GameEvent>): void {
  const { body } = racer;
  body.x = spot.x;
  body.y = spot.y;
  body.vx = 0;
  body.vy = 0;
  racer.status.invulnerable = invulnTicks;
  events.emit({ type: 'racer.respawned', id: racer.id, x: body.x, y: body.y });
}

/**
 * The racer's motion as one that keeps a park spot.
 *
 * @throws {Error} When it has none, which means its medium can't drop racers out of the level.
 */
function parkingMotion(racer: Racer): ParkingMotion {
  const { motion } = racer;
  if (!('parkedAt' in motion)) {
    throw new Error(
      `${racer.id}'s '${motion.kind}' motion has no parkedAt; a medium whose racers fall out keeps one (ParkingMotion)`,
    );
  }
  return motion as ParkingMotion;
}
