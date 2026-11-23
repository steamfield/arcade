/**
 * Black holes: a drifter whose centre is inside a horizon is swallowed, waits out of play, and
 * comes back at rest on the last spot where it flew free of every hole's reach, through the shared
 * timer in `../fall-out.ts`.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from '../../events.ts';
import { holeAt, inHoleReach } from '../../level/wells.ts';
import { centreOf } from '../../racers.ts';
import type { Racer, World } from '../../types.ts';
import { fallOut, respawnAt, waitOut } from '../fall-out.ts';
import { effectiveTuning } from '../index.ts';
import { driftMotion } from './data.ts';
import { driftExtras } from './tuning.ts';

/**
 * One tick of the black hole rule for `racer`, after it has moved: a racer that is out waits and,
 * when its wait ends, respawns; a racer in play has its last free spot kept up to date and is
 * swallowed if its centre is inside a horizon. Nothing a racer carries (invulnerability, a
 * cannonball, an item dash) keeps a horizon from taking it.
 *
 * @throws {Error} When the racer's motion isn't drift's, or the world's tuning lacks one of drift's extras.
 */
export function swallowOrRespawn(world: World, racer: Racer, events: EventSink<GameEvent>): void {
  if (racer.status.fallen > 0) {
    waitToRespawn(world, racer, events);
    return;
  }
  const centre = centreOf(racer);
  if (holeAt(world.level, centre)) {
    fallOut(racer, events, driftExtras(effectiveTuning(world)).respawnTicks);
    return;
  }
  if (!inHoleReach(world.level, centre)) driftMotion(racer.motion).lastFree = { x: racer.body.x, y: racer.body.y };
}

/** One tick out of play, putting the racer back at rest on its last free spot when the wait ends. */
function waitToRespawn(world: World, racer: Racer, events: EventSink<GameEvent>): void {
  if (!waitOut(racer)) return;
  const { lastFree } = driftMotion(racer.motion);
  respawnAt(racer, lastFree, driftExtras(effectiveTuning(world)).respawnInvulnTicks, events);
}
